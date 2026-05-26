/** Short label for the active library folder(s) in the header. */
export function formatSourcesLabel(sources: { name: string }[]): string | null {
  if (sources.length === 0) return null
  if (sources.length === 1) return sources[0].name
  return `${sources.length} folders`
}
