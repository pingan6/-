/** Define user-facing stages without inferring approval or generation readiness. */
export const CREATION_STEPS = [
  { key: 'script', title: '上传剧本', description: '导入文本，按集整理' },
  { key: 'shots', title: '拆分镜', description: '拆分、修改并确认镜头' },
  { key: 'assets', title: '资产图', description: '准备人物、场景与道具图' },
  { key: 'video', title: '视频生成', description: '检查素材，生成并查看视频' },
] as const

export type CreationStep = typeof CREATION_STEPS[number]['key']
export type CreationContext = { projectId: string; chapterId?: string; step: CreationStep | null }

/** Resolve only project routes; asset editors can retain their project return context. */
export function getCreationContext(pathname: string, search: string): CreationContext | null {
  const query = new URLSearchParams(search)
  if (pathname.startsWith('/assets/')) {
    const returnTo = query.get('returnTo')
    if (!returnTo?.startsWith('/projects/')) return null
    const [path, returnSearch = ''] = returnTo.split('?')
    const context = getCreationContext(path, returnSearch)
    return context ? { ...context, step: 'assets' } : null
  }
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] !== 'projects' || !parts[1]) return null
  const projectId = parts[1]
  const chapterId = parts[2] === 'chapters' ? parts[3] : query.get('chapterId') || undefined
  if (parts[2] === 'chapters') return { projectId, chapterId, step: parts[4] === 'studio' ? 'video' : 'shots' }
  if (parts[2] === 'roles') return { projectId, chapterId, step: 'assets' }
  if (parts[2] === 'editor') return { projectId, chapterId, step: null }
  const tab = query.get('tab') || 'chapters'
  const step: CreationStep | null = ['actors', 'roles', 'scenes', 'props', 'costumes'].includes(tab)
    ? 'assets' : tab === 'shots' ? 'shots' : tab === 'videos' ? 'video'
      : ['dashboard', 'files', 'edit', 'settings'].includes(tab) ? null : 'script'
  return { projectId, chapterId, step }
}

/** Navigation alone never calls a model, writes data or marks a preceding stage complete. */
export function getCreationStepPath(context: CreationContext, step: CreationStep): string {
  const project = `/projects/${encodeURIComponent(context.projectId)}`
  if (context.chapterId && (step === 'shots' || step === 'video')) {
    return `${project}/chapters/${encodeURIComponent(context.chapterId)}/${step === 'shots' ? 'shots' : 'studio'}`
  }
  const query = new URLSearchParams({ tab: { script: 'chapters', shots: 'shots', assets: 'roles', video: 'videos' }[step] })
  if (context.chapterId) query.set('chapterId', context.chapterId)
  return `${project}?${query}`
}
