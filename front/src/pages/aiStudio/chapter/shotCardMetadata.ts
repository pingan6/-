/** Keep card metadata scoped to its shot, including while selection requests are in flight. */
export function shotCardMetadata(
  shotId: string,
  durations: Record<string, number>,
  detail?: { id: string; movement?: string | null; duration?: number | null } | null,
) {
  const ownDetail = detail?.id === shotId ? detail : undefined
  return { movement: ownDetail?.movement ?? null, duration: durations[shotId] ?? ownDetail?.duration ?? 0 }
}
