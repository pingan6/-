import assert from 'node:assert/strict'
import { createServer as createHttpServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server
let guide

// Exercise the actual preference and navigation module without starting backend services.
before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: { server: createHttpServer() } }, appType: 'custom' })
  guide = await server.ssrLoadModule('/src/components/onboarding.ts')
})
after(async () => { await server?.close() })

// Load a fresh module for isolation because storage-unavailable handling also remembers the current session.
async function freshGuide() {
  server.moduleGraph.invalidateAll()
  return server.ssrLoadModule('/src/components/onboarding.ts')
}

// Only the guide's own preference may be read or written.
function storage(value = null) {
  return {
    value,
    getItem(key) { assert.equal(key, guide.ONBOARDING_STORAGE_KEY); return this.value },
    setItem(key, next) { assert.equal(key, guide.ONBOARDING_STORAGE_KEY); this.value = next },
  }
}

test('a first visit opens the guide and existing completion or dismissal does not', async () => {
  const module = await freshGuide()
  assert.equal(module.shouldShowOnboarding(storage()), true)
  assert.equal(module.shouldShowOnboarding(storage('completed')), false)
  assert.equal(module.shouldShowOnboarding(storage('dismissed')), false)
})

test('closing and finishing each persist without changing unrelated preferences', async () => {
  for (const outcome of ['dismissed', 'completed']) {
    const module = await freshGuide()
    const preference = storage()
    assert.equal(module.rememberOnboarding(preference, outcome), true)
    assert.equal(preference.value, outcome)
    assert.equal(module.shouldShowOnboarding(preference), false)
    const reloaded = await freshGuide()
    assert.equal(reloaded.shouldShowOnboarding(preference), false)
  }
})

test('unavailable storage does not crash the guide or force it open again in the same session', async () => {
  const module = await freshGuide()
  const blocked = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } }
  assert.equal(module.shouldShowOnboarding(blocked), true)
  assert.equal(module.rememberOnboarding(blocked, 'dismissed'), false)
  assert.equal(module.shouldShowOnboarding(blocked), false)
  const denied = await freshGuide()
  assert.equal(denied.shouldShowOnboarding(null), true)
  assert.equal(denied.rememberOnboarding(null, 'dismissed'), false)
  assert.equal(denied.shouldShowOnboarding(null), false)
})

test('next and previous stay within all five Chinese introduction steps', () => {
  assert.equal(guide.ONBOARDING_STEPS.length, 5)
  assert.equal(guide.moveOnboardingStep(0, -1), 0)
  assert.equal(guide.moveOnboardingStep(0, 1), 1)
  assert.equal(guide.moveOnboardingStep(4, 1), 4)
  assert.equal(guide.moveOnboardingStep(4, -1), 3)
  for (const step of guide.ONBOARDING_STEPS) {
    assert.ok(step.title && step.subtitle)
    assert.equal(step.points.length, 3)
  }
})

test('the shared shell exposes a closable guide without business service calls', async () => {
  const component = await readFile(new URL('../src/components/OnboardingGuide.tsx', import.meta.url), 'utf8')
  const layout = await readFile(new URL('../src/layouts/MainLayout.tsx', import.meta.url), 'utf8')
  assert.match(layout, /<OnboardingGuide \/>/)
  for (const copy of ['下一步', '上一步', '开始使用', '跳过引导', '关闭新手引导', '打开新手引导']) assert.ok(component.includes(copy))
  assert.match(component, /onCancel=\{\(\) => finish\('dismissed'\)\}/)
  assert.match(component, /overflowY: 'auto'/)
  assert.doesNotMatch(component, /services\/|fetch\(|navigate\(/)
})
