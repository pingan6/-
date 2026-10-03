import { useCallback, useRef, useState } from 'react'
import { GenerationGuard } from './generationGuard'

export type GenerationDraftState =
  | 'idle'
  | 'draft_changed'
  | 'context_changed'
  | 'deriving'
  | 'derived'
  | 'submitting'
  | 'submitted'
  | 'error'

type Updater<T> = T | ((prev: T) => T)

export type UseGenerationDraftOptions<TBase, TContext, TDerived, TSubmitResult> = {
  initialBase: TBase
  initialContext: TContext
  derive: (args: { base: TBase; context: TContext }) => Promise<TDerived>
  submit?: (args: { base: TBase; context: TContext; derived: TDerived }) => Promise<TSubmitResult>
}

export type UseGenerationDraftResult<TBase, TContext, TDerived, TSubmitResult> = {
  base: TBase
  context: TContext
  derived: TDerived | null
  state: GenerationDraftState
  error: string | null
  lastDerivedAt: number | null
  setBase: (updater: Updater<TBase>) => void
  setContext: (updater: Updater<TContext>) => void
  replaceBase: (next: TBase) => void
  replaceContext: (next: TContext) => void
  setDerived: (next: TDerived | null) => void
  setState: (next: GenerationDraftState) => void
  hydrate: (args: {
    base: TBase
    context: TContext
    derived?: TDerived | null
    state?: GenerationDraftState
  }) => void
  deriveNow: (overrides?: { base?: TBase; context?: TContext }) => Promise<TDerived | null>
  submitNow: () => Promise<TSubmitResult | null>
  resetDerived: () => void
}

/** Apply both React-style setter forms to the current synchronous draft snapshot. */
function applyUpdater<T>(prev: T, updater: Updater<T>): T {
  return typeof updater === 'function' ? (updater as (value: T) => T)(prev) : updater
}

/** Coordinate editable generation drafts without stale responses or duplicate in-flight submissions. */
export function useGenerationDraft<TBase, TContext, TDerived, TSubmitResult = void>(
  options: UseGenerationDraftOptions<TBase, TContext, TDerived, TSubmitResult>,
): UseGenerationDraftResult<TBase, TContext, TDerived, TSubmitResult> {
  const { initialBase, initialContext, derive, submit } = options
  const [base, setBaseState] = useState<TBase>(initialBase)
  const [context, setContextState] = useState<TContext>(initialContext)
  const [derived, setDerivedState] = useState<TDerived | null>(null)
  const [state, setState] = useState<GenerationDraftState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lastDerivedAt, setLastDerivedAt] = useState<number | null>(null)
  const guard = useRef(new GenerationGuard())
  const baseRef = useRef(base)
  const contextRef = useRef(context)
  const derivedRef = useRef<TDerived | null>(null)
  const derivedRevision = useRef<number | null>(null)

  const setBase = useCallback((updater: Updater<TBase>) => {
    guard.current.invalidate()
    baseRef.current = applyUpdater(baseRef.current, updater)
    setBaseState(baseRef.current)
    setState('draft_changed')
    setError(null)
  }, [])

  const setContext = useCallback((updater: Updater<TContext>) => {
    guard.current.invalidate()
    contextRef.current = applyUpdater(contextRef.current, updater)
    setContextState(contextRef.current)
    setState('context_changed')
    setError(null)
  }, [])

  const replaceBase = useCallback((next: TBase) => {
    guard.current.invalidate()
    baseRef.current = next
    setBaseState(next)
    setError(null)
  }, [])

  const replaceContext = useCallback((next: TContext) => {
    guard.current.invalidate()
    contextRef.current = next
    setContextState(next)
    setError(null)
  }, [])

  const setDerived = useCallback((next: TDerived | null) => {
    derivedRef.current = next
    derivedRevision.current = next === null ? null : guard.current.revision
    setDerivedState(next)
    if (next === null) {
      setLastDerivedAt(null)
    }
  }, [])

  const resetDerived = useCallback(() => {
    guard.current.invalidate()
    derivedRef.current = null
    derivedRevision.current = null
    setDerivedState(null)
    setLastDerivedAt(null)
    setError(null)
    setState('idle')
  }, [])

  const hydrate = useCallback((args: {
    base: TBase
    context: TContext
    derived?: TDerived | null
    state?: GenerationDraftState
  }) => {
    const nextDerived = args.derived ?? null
    guard.current.invalidate()
    baseRef.current = args.base
    contextRef.current = args.context
    derivedRef.current = nextDerived
    derivedRevision.current = nextDerived === null ? null : guard.current.revision
    setBaseState(args.base)
    setContextState(args.context)
    setDerivedState(nextDerived)
    setLastDerivedAt(nextDerived ? Date.now() : null)
    setError(null)
    setState(args.state ?? (nextDerived ? 'derived' : 'idle'))
  }, [])

  const deriveNow = useCallback(async (overrides?: { base?: TBase; context?: TContext }) => {
    const nextBase = overrides?.base ?? baseRef.current
    const nextContext = overrides?.context ?? contextRef.current
    const ticket = guard.current.beginDerivation()
    setState('deriving')
    setError(null)
    try {
      const next = await derive({ base: nextBase, context: nextContext })
      if (!guard.current.isCurrent(ticket)) return null
      derivedRef.current = next
      derivedRevision.current = ticket.revision
      setDerivedState(next)
      setLastDerivedAt(Date.now())
      setState('derived')
      return next
    } catch (err) {
      if (!guard.current.isCurrent(ticket)) return null
      setState('error')
      setError(err instanceof Error ? err.message : 'derive failed')
      return null
    }
  }, [derive])

  const submitNow = useCallback(async () => {
    if (!submit || !guard.current.acquireSubmit()) return null
    const revision = guard.current.revision
    const submittedBase = baseRef.current
    const submittedContext = contextRef.current
    try {
      let nextDerived = derivedRef.current
      if (nextDerived === null || derivedRevision.current !== revision) nextDerived = await deriveNow()
      if (nextDerived === null || guard.current.revision !== revision) return null
      setState('submitting')
      setError(null)
      const result = await submit({ base: submittedBase, context: submittedContext, derived: nextDerived })
      if (guard.current.revision === revision) setState('submitted')
      return result
    } catch (err) {
      if (guard.current.revision === revision) {
        setState('error')
        setError(err instanceof Error ? err.message : 'submit failed')
      }
      return null
    } finally {
      guard.current.releaseSubmit()
    }
  }, [deriveNow, submit])

  return {
    base,
    context,
    derived,
    state,
    error,
    lastDerivedAt,
    setBase,
    setContext,
    replaceBase,
    replaceContext,
    setDerived,
    setState,
    hydrate,
    deriveNow,
    submitNow,
    resetDerived,
  }
}
