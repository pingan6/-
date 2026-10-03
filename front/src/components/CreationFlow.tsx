import { Link, useLocation } from 'react-router-dom'
import { CREATION_STEPS, getCreationContext, getCreationStepPath } from './creationFlowRoutes'

/** Keep the same four-step navigation visible across the existing project pages. */
export function CreationFlow() {
  const { pathname, search } = useLocation()
  const context = getCreationContext(pathname, search)
  if (!context) return null
  return (
    <nav className="pa-creation-flow" aria-label="短剧创作流程">
      {CREATION_STEPS.map((step, index) => (
        <Link key={step.key} to={getCreationStepPath(context, step.key)}
          className={`pa-creation-step${context.step === step.key ? ' is-current' : ''}`}
          aria-current={context.step === step.key ? 'step' : undefined}>
          <span className="pa-step-number" aria-hidden="true">{index + 1}</span>
          <span><strong>{step.title}</strong><small>{step.description}</small></span>
        </Link>
      ))}
    </nav>
  )
}
