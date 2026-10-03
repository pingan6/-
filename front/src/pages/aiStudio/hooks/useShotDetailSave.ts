import { useCallback, useEffect, useRef, useState } from 'react'
import { StudioShotDetailsService } from '../../../services/generated'
import type { ShotDetailRead } from '../../../services/generated'
import { DraftSave, type DraftSaveStatus } from './draftSave'

const fields: readonly (keyof ShotDetailRead)[] = [
  'scene_id', 'camera_shot', 'angle', 'movement', 'duration', 'mood_tags',
  'atmosphere', 'follow_atmosphere', 'has_bgm', 'override_video_ratio',
  'vfx_type', 'vfx_note', 'action_beats', 'first_frame_prompt', 'key_frame_prompt', 'last_frame_prompt',
]
const storageKey = (id: string) => `pingan_shot_detail_draft_v1:${id}`

/** Recover only known editable fields, never IDs, from this tab's failed/unsaved drafts. */
function recover(id: string): Partial<ShotDetailRead> {
  try {
    const stored = JSON.parse(sessionStorage.getItem(storageKey(id)) ?? '{}')
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return {}
    return Object.fromEntries(fields.filter((key) => Object.prototype.hasOwnProperty.call(stored, key)).map((key) => [key, stored[key]]))
  } catch { return {} }
}

/** Share one save queue per shot and isolate late responses from the selected shot. */
export function useShotDetailSave(selectedId: string | null) {
  const selectedRef = useRef(selectedId)
  selectedRef.current = selectedId
  const queues = useRef(new Map<string, DraftSave<ShotDetailRead>>())
  const mounted = useRef(true)
  const [detail, setDetail] = useState<ShotDetailRead | null>(null)
  const [status, setStatus] = useState<DraftSaveStatus>('saved')
  const [recoveryUnavailable, setRecoveryUnavailable] = useState(false)

  // Warn before leaving while unsaved data exists; session recovery is tab-local, not a server save.
  useEffect(() => {
    mounted.current = true
    const warn = (event: BeforeUnloadEvent) => {
      if (![...queues.current.values()].some((queue) => Object.keys(queue.pending()).length)) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    const activeQueues = queues.current
    return () => {
      mounted.current = false
      window.removeEventListener('beforeunload', warn)
      activeQueues.forEach((queue) => queue.cancelTimer())
    }
  }, [])

  useEffect(() => {
    setDetail(null)
    setStatus('saved')
  }, [selectedId])

  /** Bind loaded data; recovery restores edits and performs a normal validated save attempt. */
  const bind = useCallback((server: ShotDetailRead | null) => {
    if (!server || server.id !== selectedRef.current) return
    let queue = queues.current.get(server.id)
    if (queue) queue.refresh(server)
    else {
      const id = server.id
      queue = new DraftSave(server, fields, async (patch) => {
        const response = await StudioShotDetailsService.updateShotDetailApiV1StudioShotDetailsShotIdPatch({
          shotId: id, requestBody: patch,
        })
        if (!response.data) throw new Error('保存未返回镜头详情')
        return response.data
      }, () => {
        const current = queues.current.get(id)
        if (!current) return
        try {
          const pending = current.pending()
          if (Object.keys(pending).length) sessionStorage.setItem(storageKey(id), JSON.stringify(pending))
          else sessionStorage.removeItem(storageKey(id))
        } catch {
          if (mounted.current) setRecoveryUnavailable(true)
        }
        if (mounted.current && selectedRef.current === id) {
          setDetail({ ...current.draft })
          setStatus(current.status)
        }
      })
      queues.current.set(id, queue)
      const restored = recover(id)
      if (Object.keys(restored).length) queue.update(restored)
    }
    setDetail({ ...queue.draft })
    setStatus(queue.status)
  }, [])

  /** All edit paths use the same serialized queue; switching shots cannot mix their responses. */
  const patch = useCallback((values: Partial<ShotDetailRead>, immediate = false) => {
    const queue = selectedRef.current ? queues.current.get(selectedRef.current) : null
    return queue?.update(values, immediate)
  }, [])

  /** Retry only on explicit user action, never as an unbounded background loop. */
  const retry = useCallback(() => {
    const queue = selectedRef.current ? queues.current.get(selectedRef.current) : null
    return queue?.flush()
  }, [])

  return { detail, status, bind, patch, retry, recoveryUnavailable }
}
