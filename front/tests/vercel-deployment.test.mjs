import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

// Static frontend deployment must support deep links without pretending to host APIs.
test('Vercel serves client routes but does not rewrite API requests to HTML', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'))
  assert.equal(config.framework, 'vite')
  assert.equal(config.outputDirectory, 'dist')
  assert.equal(config.buildCommand, 'pnpm run build')
  assert.equal(config.rewrites.length, 1)
  const route = config.rewrites[0]
  const matcher = new RegExp(`^${route.source}$`)
  for (const path of ['/', '/projects', '/projects/example', '/assets']) {
    assert.ok(matcher.test(path), path)
  }
  assert.equal(matcher.test('/api/v1/projects'), false)
  assert.equal(route.destination, '/index.html')
})
