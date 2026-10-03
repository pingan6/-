export type DraftSaveStatus = 'saved' | 'saving' | 'failed'

/** Compare JSON-compatible form values without treating array identity as a change. */
const equal = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/** One resource's debounced, serialized save queue; failed drafts remain available for retry. */
export class DraftSave<T extends object> {
  draft: T
  status: DraftSaveStatus = 'saved'
  private baseline: T
  private timer: ReturnType<typeof setTimeout> | null = null
  private flight: Promise<void> | null = null

  /** Only explicitly editable fields are sent; IDs and read-only properties never enter patches. */
  constructor(
    initial: T,
    private readonly fields: readonly (keyof T)[],
    private readonly save: (patch: Partial<T>) => Promise<T>,
    private readonly changed: () => void,
    private readonly delay = 1000,
  ) {
    this.draft = { ...initial }
    this.baseline = { ...initial }
  }

  /** Compute the unacknowledged draft for both persistence and browser recovery. */
  pending(): Partial<T> {
    const patch: Partial<T> = {}
    for (const key of this.fields) {
      if (!equal(this.baseline[key], this.draft[key])) patch[key] = this.draft[key]
    }
    return patch
  }

  /** Keep local edits when fresh server data arrives after switching between shots. */
  refresh(server: T): void {
    if (this.flight) return
    const pending = this.pending()
    this.baseline = { ...server }
    this.draft = { ...server, ...pending }
    this.changed()
  }

  /** Queue a form edit; immediate saves use the same queue as debounced saves. */
  update(patch: Partial<T>, immediate = false): Promise<void> | void {
    for (const key of this.fields) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) this.draft = { ...this.draft, [key]: patch[key] }
    }
    this.cancelTimer()
    if (!this.flight && Object.keys(this.pending()).length === 0) {
      this.status = 'saved'
      this.changed()
      return
    }
    this.status = 'saving'
    this.changed()
    if (immediate) return this.flush()
    this.timer = setTimeout(() => { this.timer = null; void this.flush() }, this.delay)
  }

  /** Save a snapshot once. Success drains newer edits; failure never loops automatically. */
  flush(): Promise<void> {
    this.cancelTimer()
    if (this.flight) return this.flight
    const patch = this.pending()
    if (Object.keys(patch).length === 0) {
      this.status = 'saved'
      this.changed()
      return Promise.resolve()
    }
    const submitted = { ...this.draft }
    this.status = 'saving'
    this.changed()
    this.flight = Promise.resolve().then(() => this.save(patch)).then((server) => {
      // A response may acknowledge its snapshot, but must not overwrite newer keystrokes.
      for (const key of this.fields) {
        if (equal(this.draft[key], submitted[key])) this.draft = { ...this.draft, [key]: server[key] }
      }
      this.baseline = { ...server }
      this.status = Object.keys(this.pending()).length ? 'saving' : 'saved'
    }).catch(() => {
      this.cancelTimer()
      this.status = 'failed'
    }).finally(() => {
      this.flight = null
      this.changed()
      if (this.status === 'saving') void this.flush()
    })
    return this.flight
  }

  /** Stop only the debounce timer; callers retain the pending draft for recovery. */
  cancelTimer(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }
}
