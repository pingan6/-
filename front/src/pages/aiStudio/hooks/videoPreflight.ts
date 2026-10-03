import type { ShotVideoReadinessRead } from '../../../services/generated'

/** Require the existing server readiness result before a user-visible video task is submitted. */
export function assertVideoReady(readiness: ShotVideoReadinessRead | null | undefined): void {
  if (!readiness) throw new Error('未获取到视频准备度，请稍后重试。')
  if (readiness.ready) return
  const problems = (readiness.checks ?? []).filter((check) => !check.ok).map((check) => check.message)
  throw new Error(`暂不能生成视频：${problems.length ? problems.join('；') : '请先补齐镜头生成条件。'}`)
}
