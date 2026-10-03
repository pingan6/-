import { Spin, Tag, Tooltip } from 'antd'
import { VideoCameraAddOutlined } from '@ant-design/icons'
import type { ShotRead, ShotVideoReadinessRead } from '../../../../services/generated'

type ChapterStudioVideoReadinessPanelProps = {
  selectedShot: ShotRead | null
  videoReadinessLoading: boolean
  videoReadiness: ShotVideoReadinessRead | null
  videoReferenceMode: string
}

const CHECK_LABELS: Record<string, string> = {
  extraction_ready: '镜头信息已确认', duration_ready: '镜头时长', prompt_ready: '视频提示词',
  reference_frames_ready: '参考图片', video_model_ready: '视频模型', provider_ready: '模型服务连接',
  no_active_video_task: '没有重复生成任务',
}
const REFERENCE_LABELS: Record<string, string> = {
  text_only: '纯文字', first: '首帧', last: '尾帧', key: '关键帧',
  first_last: '首尾帧', first_last_key: '首尾帧与关键帧',
}

/** Show actionable missing requirements first; keep all original checks available on demand. */
export function ChapterStudioVideoReadinessPanel({
  selectedShot,
  videoReadinessLoading,
  videoReadiness,
  videoReferenceMode,
}: ChapterStudioVideoReadinessPanelProps) {
  return (
    <div className="cs-group">
      <div className="cs-group-title">
        <VideoCameraAddOutlined /> 生成前检查
      </div>
      <div className="cs-hint">补齐下面的内容后，即可生成当前镜头的视频。</div>
      {videoReadinessLoading ? (
        <div className="py-6 text-center">
          <Spin />
        </div>
      ) : !selectedShot ? (
        <div className="text-xs text-gray-400">请先选择一个分镜。</div>
      ) : !videoReadiness ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
          暂时无法获取当前镜头的视频准备度，请稍后重试。
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <div className="text-sm font-medium text-slate-900">
                {videoReadiness.ready ? '当前镜头已满足视频生成条件' : '当前镜头还不能直接生成视频'}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                当前方式：{REFERENCE_LABELS[videoReferenceMode] ?? '其他参考方式'}
              </div>
            </div>
            <Tag color={videoReadiness.ready ? 'green' : 'gold'}>
              {videoReadiness.ready ? '可生成' : '待补齐'}
            </Tag>
          </div>

          <details>
            <summary className="text-xs text-gray-500 cursor-pointer">查看全部检查项</summary>
            <div className="flex flex-wrap gap-2 mt-2">
            {(videoReadiness.checks ?? []).map((check) => (
              <Tooltip key={check.key} title={check.message}>
                <Tag color={check.ok ? 'green' : 'default'}>
                  {check.ok ? '通过' : '待补齐'} · {CHECK_LABELS[check.key] ?? '其他条件'}
                </Tag>
              </Tooltip>
            ))}
            </div>
          </details>

          {(videoReadiness.checks ?? []).some((check) => !check.ok) ? (
            <div className="space-y-1">
              {(videoReadiness.checks ?? []).filter((check) => !check.ok).map((check) => (
                <div key={check.key} className="text-xs text-gray-600">
                  • {check.message}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
