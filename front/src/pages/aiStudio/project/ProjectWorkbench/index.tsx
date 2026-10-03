import React from 'react'
import { Card, Button, Tabs, Dropdown, Empty, Spin } from 'antd'
import { EllipsisOutlined, ArrowRightOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { TAB_CONFIG, type TabKey, isTabKey, DEFAULT_TAB } from './constants'
import { DashboardTab } from './tabs/DashboardTab'
import { ChaptersTab } from './tabs/ChaptersTab'
import { ActorsTab } from './tabs/ActorsTab'
import { RolesTab } from './tabs/RolesTab'
import { ScenesTab } from './tabs/ScenesTab'
import { CostumesTab, PropsTab } from './tabs/PropsTab'
import { FilesTab } from './tabs/FilesTab'
import { EditTab } from './tabs/EditTab'
import { SettingsTab } from './tabs/SettingsTab'
import { getChapterShotsPath, getChapterStudioPath, getProjectEditorPath } from './routes'
import { useProject, useChapters } from './hooks/useProjectData'

const ASSET_TABS = [
  { key: 'roles', label: '角色图' }, { key: 'actors', label: '演员图' },
  { key: 'scenes', label: '场景图' }, { key: 'props', label: '道具图' },
  { key: 'costumes', label: '服装图' },
]

/** Expose one task at a time; retain advanced pages and existing deep links behind a menu. */
const ProjectWorkbench: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab')
  const activeTab: TabKey = tab && isTabKey(tab) ? tab : DEFAULT_TAB
  const { project, loading: projectLoading } = useProject(projectId)
  const { chapters, loading: chaptersLoading } = useChapters(projectId)
  const isAssets = ASSET_TABS.some((item) => item.key === activeTab)

  /** Preserve the selected chapter when moving between project-level steps. */
  const setTabInUrl = (nextTab: TabKey) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams({ tab: nextTab })
      if (previous.get('chapterId')) next.set('chapterId', previous.get('chapterId')!)
      return next
    })
  }

  if (!project && projectLoading) return <div className="p-8"><Spin /> 正在加载项目…</div>
  if (!project || !projectId) return <Card><Empty description="项目不存在或暂时无法加载" /><Link to="/projects"><Button icon={<ArrowLeftOutlined />}>返回我的项目</Button></Link></Card>

  const heading = isAssets ? '准备资产图' : activeTab === 'chapters' ? '上传剧本'
    : activeTab === 'shots' ? '拆分镜' : activeTab === 'videos' ? '视频生成'
      : TAB_CONFIG.find((item) => item.key === activeTab)?.label
  const hint = isAssets ? '准备人物、场景、道具和服装的参考图；打开资产可上传图片或使用已配置模型生成。'
    : activeTab === 'chapters' ? '每集一份剧本。先导入或粘贴文本，再进入拆分镜。'
      : activeTab === 'shots' ? '选择一集，拆分镜头并检查人物、对白和动作。'
        : activeTab === 'videos' ? '选择一集，准备关键帧与参考图，通过检查后主动发起生成。' : ''

  return (
    <div className="pa-project-workflow h-full min-h-0 flex flex-col">
      <div className="pa-workflow-heading sticky top-0 z-20 shrink-0">
        <div><div className="pa-eyebrow">{project.name}</div><h1>{heading}</h1><p>{hint}</p></div>
        <div className="flex flex-wrap gap-2">
          {isAssets && <Button type="primary" icon={<ArrowRightOutlined />} onClick={() => {
            const chapterId = searchParams.get('chapterId')
            if (chapterId && chapters.some((chapter) => chapter.id === chapterId && chapter.storyboardCount > 0)) navigate(getChapterStudioPath(projectId, chapterId))
            else setTabInUrl('videos')
          }}>下一步：视频生成</Button>}
          <Dropdown trigger={['click']} menu={{ items: [
            { key: 'dashboard', label: '项目概览', onClick: () => setTabInUrl('dashboard') },
            { key: 'settings', label: '项目设置', onClick: () => setTabInUrl('settings') },
            { key: 'files', label: '项目文件', onClick: () => setTabInUrl('files') },
            { key: 'editor', label: '后期剪辑', onClick: () => navigate(getProjectEditorPath(projectId)) },
          ] }}><Button icon={<EllipsisOutlined />}>更多</Button></Dropdown>
        </div>
      </div>
      <div className="pa-project-tab-content pt-4 animate-fadeIn flex-1 min-h-0 overflow-auto">
        {isAssets && <Tabs className="pa-asset-tabs" activeKey={activeTab} onChange={(key) => setTabInUrl(key as TabKey)} items={ASSET_TABS} />}
        {activeTab === 'chapters' && <ChaptersTab />}
        {(activeTab === 'shots' || activeTab === 'videos') && (
          <Card loading={chaptersLoading}>
            {!chapters.length ? <Empty description="先上传一集剧本，再继续创作"><Button type="primary" onClick={() => setTabInUrl('chapters')}>前往上传剧本</Button></Empty> : (
              <div className="pa-chapter-choices">
                {[...chapters].sort((a, b) => a.index - b.index).map((chapter) => {
                  const hasScript = Boolean(chapter.rawText?.trim())
                  const hasShots = chapter.storyboardCount > 0
                  const needsScript = !hasScript && !hasShots
                  const label = needsScript ? '补充剧本' : activeTab === 'videos' && hasShots ? '进入视频生成' : hasShots ? '查看与确认分镜' : '开始拆分镜'
                  return <div className="pa-chapter-choice" key={chapter.id}>
                    <div><strong>第{chapter.index}集 · {chapter.title}</strong><p>{hasShots ? `已有 ${chapter.storyboardCount} 个镜头` : hasScript ? '剧本已保存，尚未拆分镜头' : '尚未录入剧本'}{activeTab === 'videos' && !hasShots ? ' · 请先完成拆分镜' : ''}</p></div>
                    <Button type="primary" onClick={() => needsScript
                      ? navigate(`/projects/${projectId}?tab=chapters&edit=${chapter.id}`)
                      : navigate(activeTab === 'videos' && hasShots ? getChapterStudioPath(projectId, chapter.id) : getChapterShotsPath(projectId, chapter.id))}>{label}</Button>
                  </div>
                })}
              </div>
            )}
          </Card>
        )}
        {activeTab === 'actors' && <ActorsTab />}
        {activeTab === 'roles' && <RolesTab />}
        {activeTab === 'scenes' && <ScenesTab />}
        {activeTab === 'props' && <PropsTab />}
        {activeTab === 'costumes' && <CostumesTab />}
        {activeTab === 'dashboard' && <DashboardTab onSelectTab={setTabInUrl} />}
        {activeTab === 'files' && <FilesTab />}
        {activeTab === 'edit' && <EditTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>
    </div>
  )
}

export default ProjectWorkbench
