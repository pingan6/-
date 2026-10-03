import assert from 'node:assert/strict'
import { createServer as createHttpServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server, resolve, describe
// Exercise the shipped resolver without contacting any API or model provider.
before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: { server: createHttpServer() } }, appType: 'custom' })
  const module = await server.ssrLoadModule('/src/services/backendConfiguration.ts')
  resolve = module.resolveBackendConfiguration
  describe = module.describeBackendFailure
})
after(async () => { await server?.close() })

test('public deployment without backend cannot silently select localhost', () => {
  const result = resolve('pingan-tech.vercel.app', 'https:')
  assert.equal(result.base, '')
  assert.match(result.error, /尚未配置/)
})
test('local development preserves its backend default', () => {
  assert.deepEqual(resolve('localhost', 'http:'), { base: 'http://localhost:8000', error: null })
  assert.equal(resolve('127.0.0.1', 'http:').error, null)
})
test('build address works without runtime override; Docker runtime retains priority', () => {
  assert.deepEqual(resolve('app.example', 'https:', undefined, 'https://api.example/'), { base: 'https://api.example', error: null })
  assert.equal(resolve('localhost', 'http:', 'http://localhost:8010', 'https://api.example').base, 'http://localhost:8010')
  assert.deepEqual(resolve('app.example', 'https:', '', 'https://api.example'), { base: '', error: null })
})
test('public loopback, mixed content and credential-bearing addresses are rejected', () => {
  for (const url of ['http://localhost:8000', 'https://127.0.0.1:8000', 'https://[::1]:8000', 'http://api.example', 'https://user:secret@api.example', 'https://api.example?key=secret', 'not a URL']) {
    const result = resolve('app.example', 'https:', url)
    assert.equal(result.base, '')
    assert.equal(typeof result.error, 'string')
    assert.ok(!result.error.includes('secret'))
  }
})
test('failure explanations separate permission, missing API, validation and server errors', () => {
  assert.match(describe({status: 403}), /访问被拒绝/)
  assert.match(describe({status: 404}), /接口不存在/)
  assert.match(describe({status: 422}), /数据不符合/)
  assert.match(describe({status: 500, body: 'secret'}), /服务异常/)
  assert.match(describe(new TypeError('secret')), /无法连接后台/)
  assert.ok(!describe({status: 500, body: 'secret'}).includes('secret'))
})
test('static runtime file does not mask Vercel build configuration with localhost', async () => {
  const source = await readFile(new URL('../public/env.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /localhost|BACKEND_URL:/)
})
test('project load failures are visible and retryable; unsuccessful create retains form', async () => {
  const lobby = await readFile(new URL('../src/pages/aiStudio/project/ProjectLobby.tsx', import.meta.url), 'utf8')
  assert.match(lobby, /项目列表未能加载/)
  assert.match(lobby, /!loadError && filteredSorted.length === 0/)
  assert.match(lobby, /onClick=\{\(\) => void load\(\)\}/)
  assert.match(lobby, /if \(!res.data \|\| !Array.isArray\(res.data.items\)\)/)
  const create = lobby.slice(lobby.indexOf('const handleCreateSubmit'), lobby.indexOf('const handleOpenEdit'))
  const failure = create.slice(create.indexOf('catch (error)'))
  assert.doesNotMatch(failure, /resetFields|setCreateModalOpen\(false\)|navigate\(/)
  assert.match(failure, /describeBackendFailure/)
})
