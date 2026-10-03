import assert from 'node:assert/strict'
import { createServer as createHttpServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server, DraftSave, GenerationGuard, assertVideoReady
// Exercise the production queue and guard, without HTTP requests or model calls.
before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: { server: createHttpServer() } }, appType: 'custom' })
  ;({ DraftSave } = await server.ssrLoadModule('/src/pages/aiStudio/hooks/draftSave.ts'))
  ;({ GenerationGuard } = await server.ssrLoadModule('/src/pages/aiStudio/hooks/generationGuard.ts'))
  ;({ assertVideoReady } = await server.ssrLoadModule('/src/pages/aiStudio/hooks/videoPreflight.ts'))
})
after(async () => { await server?.close() })
// Deferred requests reproduce response races deterministically, rather than relying on sleeps.
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('unchanged detail does not issue a save or misreport a failed state', async () => {
  let calls = 0
  const queue = new DraftSave({ id: 's1', note: 'a' }, ['note'], async () => { calls++; return {} }, () => {})
  queue.update({ note: 'a' })
  await queue.flush()
  assert.equal(calls, 0)
  assert.equal(queue.status, 'saved')
})

test('save failure retains the draft and requires an explicit retry', async () => {
  let calls = 0
  const queue = new DraftSave({ note: 'before' }, ['note'], async (patch) => {
    if (++calls === 1) throw new Error('offline')
    return patch
  }, () => {})
  await queue.update({ note: 'after' }, true)
  assert.equal(queue.status, 'failed')
  assert.equal(queue.draft.note, 'after')
  assert.deepEqual(queue.pending(), { note: 'after' })
  await Promise.resolve()
  assert.equal(calls, 1)
  await queue.flush()
  assert.equal(calls, 2)
  assert.equal(queue.status, 'saved')
  assert.deepEqual(queue.pending(), {})
})

test('old save response cannot overwrite newer keystrokes; newer edits are serialized', async () => {
  const first = deferred(), second = deferred()
  const requests = []
  const queue = new DraftSave({ note: 'original' }, ['note'], (patch) => {
    requests.push(patch)
    return requests.length === 1 ? first.promise : second.promise
  }, () => {})
  const save = queue.update({ note: 'first' }, true)
  await Promise.resolve()
  queue.update({ note: 'second' })
  assert.equal(requests.length, 1)
  first.resolve({ note: 'first' })
  await save
  assert.equal(queue.draft.note, 'second')
  assert.equal(queue.status, 'saving')
  assert.deepEqual(requests, [{ note: 'first' }, { note: 'second' }])
  second.resolve({ note: 'second' })
  await queue.flush()
  assert.equal(queue.status, 'saved')
  assert.equal(queue.draft.note, 'second')
})

test('reverting a field during an in-flight save is not discarded', async () => {
  const first = deferred()
  const requests = []
  const queue = new DraftSave({ note: 'original' }, ['note'], async (patch) => {
    requests.push(patch)
    return requests.length === 1 ? first.promise : patch
  }, () => {})
  const saving = queue.update({ note: 'edit' }, true)
  await Promise.resolve()
  queue.update({ note: 'original' })
  first.resolve({ note: 'edit' })
  await saving
  await queue.flush()
  assert.deepEqual(requests, [{ note: 'edit' }, { note: 'original' }])
  assert.equal(queue.draft.note, 'original')
  assert.equal(queue.status, 'saved')
})

test('immediate camera save and debounced prompt save share one queue', async () => {
  const first = deferred()
  let state = { duration: 3, prompt: 'before' }
  const requests = []
  const queue = new DraftSave(state, ['duration', 'prompt'], async (patch) => {
    requests.push(patch)
    if (requests.length === 1) return first.promise
    state = { ...state, ...patch }
    return state
  }, () => {})
  const saving = queue.update({ duration: 5 }, true)
  await Promise.resolve()
  queue.update({ prompt: 'new prompt' })
  state = { duration: 5, prompt: 'before' }
  first.resolve(state)
  await saving
  await queue.flush()
  assert.deepEqual(queue.draft, { duration: 5, prompt: 'new prompt' })
  assert.equal(requests.length, 2)
})

test('debounce combines rapid edits into one request', async () => {
  let calls = 0
  const complete = deferred()
  let queue
  queue = new DraftSave({ note: '' }, ['note'], async (patch) => { calls++; return patch }, () => {
    if (queue?.status === 'saved') complete.resolve()
  }, 1)
  queue.update({ note: 'a' })
  queue.update({ note: 'ab' })
  queue.update({ note: 'abc' })
  await complete.promise
  assert.equal(calls, 1)
  assert.equal(queue.draft.note, 'abc')
})

test('immutable IDs and unknown properties never enter a patch', async () => {
  let sent
  const queue = new DraftSave({ id: 'real', note: '' }, ['note'], async (patch) => {
    sent = patch
    return { id: 'real', ...patch }
  }, () => {})
  await queue.update({ id: 'fake', note: 'changed', unknown: 'ignored' }, true)
  assert.deepEqual(sent, { note: 'changed' })
  assert.equal(queue.draft.id, 'real')
})

test('fresh server reads preserve unsaved edits but refresh untouched fields', () => {
  const queue = new DraftSave({ note: 'old', duration: 3 }, ['note', 'duration'], async () => ({}), () => {})
  queue.update({ note: 'unsaved' })
  queue.refresh({ note: 'old', duration: 8 })
  assert.deepEqual(queue.draft, { note: 'unsaved', duration: 8 })
  assert.deepEqual(queue.pending(), { note: 'unsaved' })
  queue.cancelTimer()
})

test('shots have isolated queues and cannot overwrite each other', async () => {
  const response = deferred()
  const first = new DraftSave({ note: 'one' }, ['note'], () => response.promise, () => {})
  const second = new DraftSave({ note: 'two' }, ['note'], async (patch) => patch, () => {})
  const saving = first.update({ note: 'one edit' }, true)
  await second.update({ note: 'two edit' }, true)
  response.resolve({ note: 'one edit' })
  await saving
  assert.equal(first.draft.note, 'one edit')
  assert.equal(second.draft.note, 'two edit')
})

test('derive response is rejected after editing or hydration', () => {
  const guard = new GenerationGuard()
  const ticket = guard.beginDerivation()
  guard.invalidate()
  assert.equal(guard.isCurrent(ticket), false)
  assert.equal(guard.isCurrent(guard.beginDerivation()), true)
})

test('out-of-order derive responses accept only the latest request', () => {
  const guard = new GenerationGuard()
  const first = guard.beginDerivation(), second = guard.beginDerivation()
  assert.equal(guard.isCurrent(first), false)
  assert.equal(guard.isCurrent(second), true)
})

test('duplicate submit is rejected synchronously and retry works after release', () => {
  const guard = new GenerationGuard()
  assert.equal(guard.acquireSubmit(), true)
  assert.equal(guard.acquireSubmit(), false)
  guard.invalidate()
  assert.equal(guard.acquireSubmit(), false)
  guard.releaseSubmit()
  assert.equal(guard.acquireSubmit(), true)
})

test('failed save UI exposes retry and per-shot recovery without replacing domain state', async () => {
  const studio = await readFile(new URL('../src/pages/aiStudio/chapter/ChapterStudio.tsx', import.meta.url), 'utf8')
  const hook = await readFile(new URL('../src/pages/aiStudio/hooks/useShotDetailSave.ts', import.meta.url), 'utf8')
  assert.match(studio, /保存失败，草稿仍保留/)
  assert.match(studio, /重试保存/)
  assert.match(studio, /镜头详情加载失败/)
  assert.match(studio, /重试加载/)
  assert.match(hook, /sessionStorage\.setItem/)
  assert.match(hook, /selectedRef\.current === id/)
  assert.match(hook, /beforeunload/)
})

test('video preflight passes ready shots and blocks missing prerequisites with explanations', () => {
  assert.doesNotThrow(() => assertVideoReady({ ready: true }))
  assert.throws(() => assertVideoReady(null), /未获取到视频准备度/)
  assert.throws(() => assertVideoReady({ ready: false, checks: [
    { ok: false, message: '尚未配置视频模型' }, { ok: false, message: '镜头仍有运行中的视频任务' },
  ] }), /尚未配置视频模型；镜头仍有运行中的视频任务/)
  assert.throws(() => assertVideoReady({ ready: false }), /补齐镜头生成条件/)
})

test('video submission checks readiness before creating a task and renders errors', async () => {
  const studio = await readFile(new URL('../src/pages/aiStudio/chapter/ChapterStudio.tsx', import.meta.url), 'utf8')
  assert.ok(studio.indexOf('assertVideoReady(readiness.data)') < studio.indexOf('FilmService.createVideoGenerationTaskApiV1FilmTasksVideoPost'))
  assert.match(studio, /videoPromptDraft.error &&/)
  assert.match(studio, /if \(videoSubmitLockRef.current\) return/)
})
