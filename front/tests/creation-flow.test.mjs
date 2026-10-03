import assert from 'node:assert/strict'
import { createServer as createHttpServer } from 'node:http'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'

let server
let flow
let script

// Exercise actual routing and import code without business writes or provider requests.
before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: { server: createHttpServer() } }, appType: 'custom' })
  flow = await server.ssrLoadModule('/src/components/creationFlowRoutes.ts')
  script = await server.ssrLoadModule('/src/components/scriptImport.ts')
})
after(async () => { await server?.close() })

test('direct project entry starts with script and all legacy advanced links still resolve', () => {
  assert.equal(flow.getCreationContext('/projects/p1', '').step, 'script')
  assert.equal(flow.getCreationContext('/projects/p1', '?tab=unknown').step, 'script')
  for (const tab of ['roles', 'actors', 'scenes', 'props', 'costumes']) {
    assert.equal(flow.getCreationContext('/projects/p1', `?tab=${tab}`).step, 'assets')
  }
  for (const tab of ['dashboard', 'files', 'settings', 'edit']) {
    assert.equal(flow.getCreationContext('/projects/p1', `?tab=${tab}`).step, null)
  }
  assert.equal(flow.getCreationContext('/assets', ''), null)
  assert.equal(flow.getCreationContext('/projects', ''), null)
})

test('moving from shots through assets to video retains the exact project and chapter', () => {
  const shots = flow.getCreationContext('/projects/p1/chapters/c2/shots/s3/edit', '')
  assert.deepEqual(shots, { projectId: 'p1', chapterId: 'c2', step: 'shots' })
  const assetsUrl = flow.getCreationStepPath(shots, 'assets')
  assert.equal(assetsUrl, '/projects/p1?tab=roles&chapterId=c2')
  const [path, search] = assetsUrl.split('?')
  const assets = flow.getCreationContext(path, search)
  assert.equal(flow.getCreationStepPath(assets, 'video'), '/projects/p1/chapters/c2/studio')
  assert.equal(flow.getCreationStepPath(assets, 'shots'), '/projects/p1/chapters/c2/shots')
  assert.equal(flow.getCreationStepPath(assets, 'script'), '/projects/p1?tab=chapters&chapterId=c2')
})

test('no chapter context uses chapter pickers rather than guessing a chapter', () => {
  const context = flow.getCreationContext('/projects/p1', '')
  assert.equal(flow.getCreationStepPath(context, 'shots'), '/projects/p1?tab=shots')
  assert.equal(flow.getCreationStepPath(context, 'video'), '/projects/p1?tab=videos')
  assert.equal(flow.getCreationContext('/projects/p1/chapters/c2/studio', '').step, 'video')
})

test('project asset edit context accepts only internal project return links', () => {
  assert.equal(flow.getCreationContext('/assets/actors/a1/edit', '?returnTo=https%3A%2F%2Fexample.com%2Fprojects%2Fp1'), null)
  const context = flow.getCreationContext('/assets/actors/a1/edit', '?returnTo=%2Fprojects%2Fp1%3Ftab%3Dactors')
  assert.deepEqual(context, { projectId: 'p1', chapterId: undefined, step: 'assets' })
})

// Files are memory-only inputs and rejected reads never mutate an existing draft.
function textFile(text, name = '第一集.txt') {
  const bytes = new TextEncoder().encode(text)
  return { name, size: bytes.length, arrayBuffer: async () => bytes.buffer }
}

test('TXT import preserves Chinese dialogue, line breaks and English without normalization', async () => {
  const text = '日 内 客厅\r\n甲：你好！\r\n乙：Hello.\n'
  assert.equal(await script.readScriptText(textFile(text)), text)
  assert.equal(await script.readScriptText(textFile('\uFEFF' + text, 'scene.TXT')), text)
})

test('non-text, empty, invalid UTF-8 and oversized imports fail explicitly', async () => {
  await assert.rejects(() => script.readScriptText(textFile('script', '剧本.pdf')), /TXT/)
  await assert.rejects(() => script.readScriptText(textFile(' \n\t')), /没有剧本文字/)
  await assert.rejects(() => script.readScriptText(textFile('a\u0000b')), /纯文本/)
  await assert.rejects(() => script.readScriptText({ name: 'x.txt', size: 2, arrayBuffer: async () => new Uint8Array([0xff, 0xff]).buffer }), /UTF-8/)
  await assert.rejects(() => script.readScriptText({ name: 'large.txt', size: 2 * 1024 * 1024 + 1, arrayBuffer: async () => { throw new Error('must not read oversized file') } }), /2MB/)
  await assert.rejects(() => script.readScriptText({ name: 'missing.txt', size: 10, arrayBuffer: async () => { throw new Error('read failed') } }), /读取失败/)
})
