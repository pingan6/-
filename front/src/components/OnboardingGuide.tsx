import { useState } from 'react'
import { Button, Modal, Progress } from 'antd'
import { QuestionCircleOutlined } from '@ant-design/icons'
import {
  ONBOARDING_STEPS,
  moveOnboardingStep,
  rememberOnboarding,
  shouldShowOnboarding,
  type OnboardingOutcome,
} from './onboarding'

/** Reading the storage property may be prohibited; the guide can still be closed in memory. */
function browserStorage(): Storage | null {
  try { return window.localStorage } catch { return null }
}

/** Explain the existing workflow on first visit, with optional navigation and persistent dismissal. */
export function OnboardingGuide() {
  const [open, setOpen] = useState(() => shouldShowOnboarding(browserStorage()))
  const [current, setCurrent] = useState(0)
  const step = ONBOARDING_STEPS[current]
  const isLast = current === ONBOARDING_STEPS.length - 1

  /** All close controls share one exit path; no navigation, confirmation or paid calls are performed. */
  const finish = (outcome: OnboardingOutcome) => {
    rememberOnboarding(browserStorage(), outcome)
    setOpen(false)
  }

  /** Reopen from the beginning without clearing the stored first-visit preference. */
  const reopen = () => {
    setCurrent(0)
    setOpen(true)
  }

  return (
    <>
      <Button type="text" icon={<QuestionCircleOutlined />} onClick={reopen} aria-label="打开新手引导">
        <span className="hidden sm:inline">新手引导</span>
      </Button>
      <Modal
        open={open}
        title="平安科技 · 新手引导"
        centered
        width={560}
        onCancel={() => finish('dismissed')}
        closeIcon={<span aria-label="关闭新手引导">×</span>}
        maskClosable={false}
        keyboard
        styles={{ body: { maxHeight: 'calc(100dvh - 220px)', overflowY: 'auto' } }}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="text" onClick={() => finish('dismissed')}>跳过引导</Button>
            <div className="flex gap-2">
              {current > 0 && <Button onClick={() => setCurrent(value => moveOnboardingStep(value, -1))}>上一步</Button>}
              <Button type="primary" onClick={() => isLast ? finish('completed') : setCurrent(value => moveOnboardingStep(value, 1))}>
                {isLast ? '开始使用' : '下一步'}
              </Button>
            </div>
          </div>
        }
      >
        <div aria-live="polite" aria-atomic="true" className="py-3">
          <p className="text-sm text-gray-500 mb-2">第 {current + 1} 步 / 共 {ONBOARDING_STEPS.length} 步</p>
          <Progress percent={((current + 1) / ONBOARDING_STEPS.length) * 100} showInfo={false} size="small" />
          <h2 className="text-xl font-semibold mt-5 mb-2">{step.title}</h2>
          <p className="text-gray-500 mb-4">{step.subtitle}</p>
          <ul className="list-disc pl-5 space-y-3 text-gray-700 leading-relaxed">
            {step.points.map(point => <li key={point}>{point}</li>)}
          </ul>
        </div>
      </Modal>
    </>
  )
}
