/** Synchronous locks and revision tickets protect async derivation and submission before React renders. */
export class GenerationGuard {
  revision = 0
  private sequence = 0
  private submitting = false

  /** Editing or hydrating invalidates all earlier derivation responses. */
  invalidate(): void { this.revision += 1; this.sequence += 1 }

  /** Only the newest derivation of the current revision may update the draft. */
  beginDerivation(): { revision: number; sequence: number } {
    return { revision: this.revision, sequence: ++this.sequence }
  }

  /** Test a completion ticket before accepting its data or error. */
  isCurrent(ticket: { revision: number; sequence: number }): boolean {
    return ticket.revision === this.revision && ticket.sequence === this.sequence
  }

  /** Reject duplicate clicks immediately, including while a required derivation is running. */
  acquireSubmit(): boolean {
    if (this.submitting) return false
    this.submitting = true
    return true
  }

  /** Release after success or failure so a deliberate later retry remains possible. */
  releaseSubmit(): void { this.submitting = false }
}
