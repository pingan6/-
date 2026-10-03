/** Keep first-use instructions separate from rendering and never dispatch business actions. */
export const ONBOARDING_STEPS = [
  {
    title: '欢迎使用平安科技',
    subtitle: '从一个故事开始，逐步准备你的短剧镜头。',
    points: [
      '打开项目后，按顶部四步操作：上传剧本 → 拆分镜 → 资产图 → 视频生成。',
      'AI 提供建议，导演负责检查、修改和确认，重要内容不会自动替你批准。',
      '点击“下一步”了解功能，也可以随时点击右上角 × 或“跳过引导”。',
    ],
  },
  {
    title: '项目与剧本',
    subtitle: '通过顶部“项目管理”，在“我的项目”开始和继续创作。',
    points: [
      '创建项目后直接进入“上传剧本”，导入 TXT 文件或粘贴文字，每集保存一份。',
      '已有项目可以直接打开，继续处理原文、分镜和镜头准备。',
      '需要模型处理的提取操作，应先配置模型，再由你主动发起。',
    ],
  },
  {
    title: '资产与镜头准备',
    subtitle: '先确认人物、空间和动作，再进入生成阶段。',
    points: [
      '“资产图”集中管理本项目的角色、演员、场景、道具和服装图片；顶部“资产库”可跨项目复用。',
      '在分镜列表进入“编辑”，核对标题、剧本摘录、镜头语言、动作拍点及资产和对白候选。',
      '完成信息确认后再进入工作室；“已就绪”不代表视频生成条件已全部满足。',
    ],
  },
  {
    title: '视频生成',
    subtitle: '集中准备关键帧、参考图和视频生成参数。',
    points: [
      '左侧选择镜头，中间查看媒体；右侧优先显示“视频生成”和“关键帧与参考图”，其他参数在“高级设置”。',
      '按准备度提示补齐缺项；需要修正提取结果时返回分镜编辑页。',
      '生成操作由你主动发起，可能产生供应商费用。浏览新手引导不会调用模型。',
    ],
  },
  {
    title: '模板、模型与任务',
    subtitle: '了解辅助入口，开始你的创作。',
    points: [
      '顶部“高级工具”收纳“提示词模板”“模型管理”和“系统设置”，需要时再展开。',
      '“任务中心”查看运行状态、失败信息及任务回跳入口，不用一直停留在同一个页面。',
      '完成或关闭引导后，本浏览器不会再次自动弹出。需要复习时点击顶部“新手引导”。',
    ],
  },
] as const

export const ONBOARDING_STORAGE_KEY = 'pingan_onboarding_v1'
export type OnboardingOutcome = 'completed' | 'dismissed'
type GuideStorage = Pick<Storage, 'getItem' | 'setItem'>
let dismissedInSession = false

/** Read only this guide preference; blocked browser storage must not prevent using the app. */
export function shouldShowOnboarding(storage: GuideStorage | null): boolean {
  if (dismissedInSession) return false
  try {
    const value = storage?.getItem(ONBOARDING_STORAGE_KEY)
    return value !== 'completed' && value !== 'dismissed'
  } catch {
    return true
  }
}

/** Remember either exit path without touching projects, drafts or other browser preferences. */
export function rememberOnboarding(storage: GuideStorage | null, outcome: OnboardingOutcome): boolean {
  dismissedInSession = true
  if (!storage) return false
  try {
    storage.setItem(ONBOARDING_STORAGE_KEY, outcome)
    return true
  } catch {
    return false
  }
}

/** Bound navigation so the first and final page never produce an undefined guide step. */
export function moveOnboardingStep(current: number, direction: -1 | 1): number {
  return Math.max(0, Math.min(ONBOARDING_STEPS.length - 1, current + direction))
}
