import type { ReactNode } from 'react'
import {
  EditOutlined,
  FileSearchOutlined,
  ScissorOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons'
import type { Chapter } from './hooks/useProjectData'

export type ChapterPreparationState = {
  key: 'edit_raw' | 'extract_shots' | 'prepare_shots' | 'shoot'
  text: string
  color: string
  hint: string
  primaryAction: string
  primaryIcon: ReactNode
}

/** Recommend a destination without treating chapter status as video readiness. */
export function getChapterPreparationState(chapter: Chapter): ChapterPreparationState {
  const hasRawText = !!chapter.rawText?.trim()
  const hasShots = (chapter.storyboardCount ?? 0) > 0
  if (!hasRawText) {
    return {
      key: 'edit_raw',
      text: '待录入原文',
      color: 'default',
      hint: '先保存本集剧本，再拆分镜',
      primaryAction: '补充剧本',
      primaryIcon: <EditOutlined />,
    }
  }
  if (!hasShots) {
    return {
      key: 'extract_shots',
      text: '待拆分镜',
      color: 'gold',
      hint: '剧本已保存，可以开始拆分镜',
      primaryAction: '下一步：拆分镜',
      primaryIcon: <ScissorOutlined />,
    }
  }
  if (chapter.status === 'shooting' || chapter.status === 'done') {
    return {
      key: 'shoot',
      text: '已有分镜',
      color: 'green',
      hint: '进入视频页后，仍需检查素材和生成条件',
      primaryAction: '进入视频生成',
      primaryIcon: <VideoCameraOutlined />,
    }
  }
  return {
    key: 'prepare_shots',
    text: '待检查分镜',
    color: 'blue',
    hint: '检查并确认镜头信息，再准备资产图',
    primaryAction: '查看与确认分镜',
    primaryIcon: <FileSearchOutlined />,
  }
}
