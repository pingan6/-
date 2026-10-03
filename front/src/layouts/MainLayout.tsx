import React, { useMemo } from 'react'
import { Layout, Menu, theme, Dropdown, Space, Avatar, Select, Button, Alert } from 'antd'
import { ArrowLeftOutlined, SettingOutlined, UserOutlined, FolderOutlined, PictureOutlined, FileTextOutlined, ApiOutlined } from '@ant-design/icons'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { useTranslation } from 'react-i18next'
import { TaskCenter } from '../pages/aiStudio/components/TaskCenter'
import { TaskRuntimeProvider } from '../pages/aiStudio/components/TaskRuntimeProvider'
import { OnboardingGuide } from '../components/OnboardingGuide'
import { CreationFlow } from '../components/CreationFlow'
import { getCreationContext } from '../components/creationFlowRoutes'
import '../styles/pingan-workspace.css'
import { backendConfiguration } from '../services/openapi'

const { Header, Content } = Layout

/** Share one compact horizontal navigation and theme across all existing production routes. */
const MainLayout: React.FC = () => {
  const { t, i18n } = useTranslation('layout')
  const location = useLocation()
  const navigate = useNavigate()
  const { token } = theme.useToken()
  const user = useAppStore((state) => state.user)
  const language = useAppStore((state) => state.language)
  const setLanguage = useAppStore((state) => state.setLanguage)
  const context = getCreationContext(location.pathname, location.search)

  const selectedKeys = useMemo(() => {
    if (location.pathname.startsWith('/projects')) return ['projects']
    if (location.pathname.startsWith('/assets')) return ['assets']
    if (location.pathname.startsWith('/prompts')) return ['prompts']
    if (location.pathname.startsWith('/models')) return ['models']
    if (location.pathname.startsWith('/settings')) return ['settings']
    return []
  }, [location.pathname])

  const menuItems = [
    { key: 'projects', icon: <FolderOutlined />, label: <Link to="/projects">项目管理</Link> },
    { key: 'assets', icon: <PictureOutlined />, label: <Link to="/assets">资产库</Link> },
    {
      key: 'advanced', icon: <SettingOutlined />, label: '高级工具', children: [
        { key: 'prompts', icon: <FileTextOutlined />, label: <Link to="/prompts">提示词模板</Link> },
        { key: 'models', icon: <ApiOutlined />, label: <Link to="/models">模型管理</Link> },
        { key: 'settings', icon: <SettingOutlined />, label: <Link to="/settings">{t('menu.settings')}</Link> },
      ],
    },
  ]

  return (
    <Layout className="pa-shell" style={{ height: '100dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <Header className="pa-header" style={{ flexShrink: 0, background: token.colorBgContainer }}>
        {context && <Button className="pa-back-button" icon={<ArrowLeftOutlined />} onClick={() => navigate(
          location.pathname === `/projects/${context.projectId}` ? '/projects' : `/projects/${context.projectId}`
        )}><span>返回</span></Button>}
        <Link to="/projects" className="pa-brand" aria-label="平安科技首页">
          <img src="/pingan-mark.svg" alt="平安科技" width={32} height={32} />
          <span>{t('title')}</span>
        </Link>
        <Menu className="pa-main-nav" mode="horizontal" selectedKeys={selectedKeys} items={menuItems} />
        <Space className="pa-header-tools" size={10}>
          <OnboardingGuide />
          <Select className="pa-language" size="small" value={language} style={{ width: 112 }}
            onChange={(value) => {
              setLanguage(value)
              void i18n.changeLanguage(value)
              window.localStorage.setItem('jellyfish_language', value)
              document.documentElement.lang = value === 'en-US' ? 'en' : 'zh-CN'
            }} options={[{ label: t('lang.zh'), value: 'zh-CN' }, { label: t('lang.en'), value: 'en-US' }]} />
          <Dropdown placement="bottomRight" menu={{ items: [{ key: 'settings', label: t('menu.settings'), onClick: () => navigate('/settings') }] }}>
            <button type="button" className="pa-user-button" aria-label="账户设置">
              <Avatar size={28} icon={<UserOutlined />} /><span>{user.name}</span>
            </button>
          </Dropdown>
        </Space>
      </Header>
      <TaskRuntimeProvider>
        <Content className="pa-content" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: token.colorBgLayout }}>
          <CreationFlow />
          {backendConfiguration.error && <Alert type="warning" showIcon
            message="当前网站仅完成界面部署"
            description={backendConfiguration.error}
            style={{ flexShrink: 0, margin: 16 }} />}
          {/* Natural-height pages scroll here; fitted workspaces continue to own their panel scrolling. */}
          <div className="pa-page-viewport w-full h-full min-h-0 overflow-auto flex flex-col"><Outlet /></div>
        </Content>
        <TaskCenter />
      </TaskRuntimeProvider>
    </Layout>
  )
}

export default MainLayout
