import assert from 'node:assert/strict'
import { createServer as createHttpServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server
let sample

// Load the actual TypeScript presentation module without a browser or backend requests.
before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: { server: createHttpServer() } }, appType: 'custom' })
  sample = await server.ssrLoadModule('/src/theme/pingan.ts')
})
after(async () => { await server?.close() })

// Both languages keep the approved Chinese brand, including the browser document title.
test('platform branding is 平安科技 in both locales and the browser title', async () => {
  for (const locale of ['zh-CN', 'en-US']) {
    const layout = JSON.parse(await readFile(new URL(`../src/locales/${locale}/layout.json`, import.meta.url), 'utf8'))
    assert.equal(layout.title, '平安科技')
    assert.ok(layout.welcome.includes('平安科技'))
    assert.ok(!layout.welcome.includes('平安剧场'))
    assert.ok(!layout.welcome.includes('Jellyfish'))
  }
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8')
  assert.match(html, /<title>平安科技<\/title>/)
  assert.match(html, /href="\/pingan-mark-pa-v1.png"/)
  const mainLayout = await readFile(new URL('../src/layouts/MainLayout.tsx', import.meta.url), 'utf8')
  const lobby = await readFile(new URL('../src/pages/aiStudio/project/ProjectLobby.tsx', import.meta.url), 'utf8')
  assert.match(mainLayout, /alt="平安科技 PA 商标"/)
  assert.ok(lobby.includes('平安科技 · 创作项目'))
  assert.ok(lobby.includes('平安科技 / 创作空间'))
  assert.ok(!lobby.includes('平安剧场'))
})

// Rebranding must not migrate or erase existing per-browser layout/language preferences.
test('existing browser preference keys are preserved', async () => {
  const layout = await readFile(new URL('../src/layouts/MainLayout.tsx', import.meta.url), 'utf8')
  const studio = await readFile(new URL('../src/pages/aiStudio/chapter/ChapterStudio.tsx', import.meta.url), 'utf8')
  assert.match(layout, /'jellyfish_language'/)
  assert.match(studio, /'jellyfish_chapter_studio_layout_v1'/)
})

// Route changes share the same horizontal navigation, not another application's shell.
test('all routes share one root theme and a constant navigation shell', async () => {
  const root = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8')
  const layout = await readFile(new URL('../src/layouts/MainLayout.tsx', import.meta.url), 'utf8')
  assert.match(root, /theme=\{pinganTheme\}/)
  assert.match(layout, /className="pa-shell"/)
  assert.match(layout, /className="pa-main-nav" mode="horizontal"/)
  assert.doesNotMatch(layout, /<Sider|<Breadcrumb/)
  assert.doesNotMatch(layout, /isVisualSample|isPinganSamplePath|ConfigProvider/)
  assert.doesNotMatch(root, /#1677ff/)
  assert.equal(sample.isPinganSamplePath, undefined)
})

// Visual tokens must not override success/error/warning state semantics.
test('shared theme changes visual tokens, not domain status colors', () => {
  assert.equal(sample.pinganTheme.token.colorPrimary, '#a855f7')
  assert.equal(sample.pinganTheme.token.colorBgLayout, '#08080b')
  assert.equal(typeof sample.pinganTheme.algorithm, 'function')
  for (const key of ['colorSuccess', 'colorError', 'colorWarning']) {
    assert.equal(sample.pinganTheme.token[key], undefined)
  }
})

// Portalled dialogs and legacy light utilities must stay legible when moving between workspaces.
test('dark reference theme covers legacy surfaces and portalled dialogs', async () => {
  const css = await readFile(new URL('../src/styles/pingan-workspace.css', import.meta.url), 'utf8')
  assert.match(css, /:is\(\.pa-shell, \.ant-modal, \.ant-drawer, \.ant-popover\)/)
  assert.match(css, /\.bg-white \{ background-color: #18181d/)
  assert.match(css, /linear-gradient\(135deg, #7c3aed, #db2777\)/)
  assert.match(css, /max-width: 600px/)
  assert.match(css, /\.pa-user-button:focus-visible/)
})

// The reference-inspired card interaction reuses safe forms and preserves the existing task gate.
test('script cards retain editing, task status and an optional table view', async () => {
  const chapters = await readFile(new URL('../src/pages/aiStudio/project/ProjectWorkbench/tabs/ChaptersTab.tsx', import.meta.url), 'utf8')
  assert.match(chapters, /\[listView, setListView\] = useState\(false\)/)
  assert.match(chapters, /aria-label="上传新剧本"/)
  assert.match(chapters, /onClick=\{\(\) => openEditModal\(chapter\)\}/)
  assert.match(chapters, /renderChapterActions\(chapter\)/)
  assert.match(chapters, /chapterDivisionTaskMap\[chapter.id\]/)
  const actions = chapters.slice(chapters.indexOf('const renderChapterActions'), chapters.indexOf('const columns:'))
  assert.doesNotMatch(actions, /Service\.|generate|divideChapter/)
  assert.match(actions, /handlePrimaryAction\(record\)/)
})

// Motion preference and keyboard focus remain present in the delivered stylesheet.
test('sample stylesheet includes reduced-motion and keyboard focus affordances', async () => {
  const css = await readFile(new URL('../src/styles/pingan-workspace.css', import.meta.url), 'utf8')
  assert.match(css, /prefers-reduced-motion: reduce/)
  assert.match(css, /focus-visible/)
  assert.match(css, /\.pa-shell \.pa-studio/)
  assert.doesNotMatch(css, /pa-sample-shell/)
})

// Brand-colored submit buttons must not recolor a destructive primary button.
test('global button styling preserves destructive action colors', async () => {
  const css = await readFile(new URL('../src/styles/pingan-workspace.css', import.meta.url), 'utf8')
  assert.match(css, /\.ant-btn-primary:not\(\.ant-btn-dangerous\)/)
  assert.doesNotMatch(css, /\.ant-btn-primary\s*\{/)
})

// All asset tabs share a bounded scroll owner rather than being clipped by the shell.
test('asset management owns an accessible shrinking vertical scroll area', async () => {
  const assets = await readFile(new URL('../src/pages/aiStudio/assets/AssetManager.tsx', import.meta.url), 'utf8')
  assert.match(assets, /className="pa-assets min-h-0 flex-1 overflow-y-auto space-y-4"/)
  assert.match(assets, /role="region" aria-label="资产管理内容" tabIndex=\{0\}/)
  for (const tab of ['ActorsTab', 'ScenesTab', 'PropsTab', 'CostumesTab']) {
    assert.ok(assets.includes(`children: <${tab} />`))
  }
})

// Natural-height routes and project tabs must have a fallback when content exceeds the viewport.
test('ordinary routes and project tabs can scroll without changing fitted workspaces', async () => {
  const layout = await readFile(new URL('../src/layouts/MainLayout.tsx', import.meta.url), 'utf8')
  const project = await readFile(new URL('../src/pages/aiStudio/project/ProjectWorkbench/index.tsx', import.meta.url), 'utf8')
  assert.match(layout, /pa-page-viewport w-full h-full min-h-0 overflow-auto flex flex-col/)
  assert.match(project, /pa-project-tab-content pt-4 animate-fadeIn flex-1 min-h-0 overflow-auto/)
  assert.match(project, /sticky top-0 z-20 shrink-0/)
})

// Verify every settings translation resolves in both supplied locales, not to a resource key.
test('settings uses valid explicit namespace keys in both languages', async () => {
  const settings = await readFile(new URL('../src/pages/Settings.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(settings, /t\('settings\./)
  const keys = [...settings.matchAll(/t\('settings:([^']+)'\)/g)].map(match => match[1])
  assert.ok(keys.length > 0)
  for (const locale of ['zh-CN', 'en-US']) {
    const resource = JSON.parse(await readFile(new URL(`../src/locales/${locale}/settings.json`, import.meta.url), 'utf8'))
    for (const key of keys) {
      assert.equal(typeof key.split('.').reduce((value, part) => value?.[part], resource), 'string', `${locale}: ${key}`)
    }
  }
})

// Missing preparation resources must remain visible, without inventing data or navigating away.
test('shot loading errors remain retryable and extraction status is displayed in Chinese', async () => {
  const edit = await readFile(new URL('../src/pages/aiStudio/shots/ChapterShotEditPage.tsx', import.meta.url), 'utf8')
  const list = await readFile(new URL('../src/pages/aiStudio/shots/ChapterShotsPage.tsx', import.meta.url), 'utf8')
  const failure = edit.slice(edit.indexOf('} catch (error)'), edit.indexOf('} finally {', edit.indexOf('} catch (error)')))
  assert.match(failure, /setLoadError/)
  assert.doesNotMatch(failure, /navigate\(/)
  assert.match(edit, /role="alert"/)
  assert.match(edit, /onClick=\{\(\) => void loadPage\(\)\}>重试加载/)
  assert.match(list, /pending: '待确认', generating: '生成中', ready: '已就绪'/)
})

// The editor must return to an existing project-tab route rather than a nonexistent URL.
test('video editor returns to the canonical chapter list', async () => {
  const editor = await readFile(new URL('../src/pages/aiStudio/editor/VideoEditor.tsx', import.meta.url), 'utf8')
  assert.match(editor, /getProjectChaptersPath\(projectId\)/)
  assert.doesNotMatch(editor, /`\/projects\/\$\{projectId\}\/chapters`/)
  const routes = await server.ssrLoadModule('/src/pages/aiStudio/project/ProjectWorkbench/routes.ts')
  assert.equal(routes.getProjectChaptersPath('example-id'), '/projects/example-id?tab=chapters')
})
