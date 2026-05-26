import type { CollectionSummary, MatchFeel, SearchPlanSummary } from '../api/client'

export type ContentFilter = 'all' | 'yes' | 'no'
export type TimeFilter = 'any' | 'this_year' | 'last_year' | 'custom'

export interface SearchChipState {
  match: MatchFeel
  content: ContentFilter
  folder: string
  time: TimeFilter
  dateAfter: string
  dateBefore: string
}

export const defaultChipState: SearchChipState = {
  match: 'balanced',
  content: 'all',
  folder: '',
  time: 'any',
  dateAfter: '',
  dateBefore: '',
}

export function activeFilterLabels(chips: SearchChipState): string[] {
  const labels: string[] = []
  if (chips.match === 'broad') labels.push('Broad')
  if (chips.match === 'strict') labels.push('Close')
  if (chips.content === 'yes') labels.push('With text')
  if (chips.content === 'no') labels.push('Images only')
  if (chips.folder) labels.push(chips.folder)
  if (chips.time === 'this_year') labels.push('This year')
  if (chips.time === 'last_year') labels.push('Last year')
  if (chips.time === 'custom') labels.push('Custom range')
  return labels
}

export function chipsAreActive(chips: SearchChipState): boolean {
  return (
    chips.match !== 'balanced' ||
    chips.content !== 'all' ||
    chips.folder !== '' ||
    chips.time !== 'any'
  )
}

/** Query string sent to the API (time operators appended; folder/match/content use params). */
export function apiSearchQuery(text: string, chips: SearchChipState): string {
  const built = buildSearchQuery(text, chips)
  if (built) return built
  return chipsAreActive(chips) ? ' ' : ''
}

export function buildSearchQuery(text: string, chips: SearchChipState): string {
  const parts: string[] = []
  const trimmed = text.trim()
  if (trimmed) parts.push(trimmed)

  if (chips.time === 'this_year') {
    parts.push(`during:${new Date().getFullYear()}`)
  } else if (chips.time === 'last_year') {
    parts.push(`during:${new Date().getFullYear() - 1}`)
  } else if (chips.time === 'custom') {
    if (chips.dateAfter) parts.push(`after:${chips.dateAfter}`)
    if (chips.dateBefore) parts.push(`before:${chips.dateBefore}`)
  }

  return parts.join(' ').trim()
}

export function chipsFromPlan(plan: SearchPlanSummary): SearchChipState {
  const chips = { ...defaultChipState }
  chips.match = plan.match || 'balanced'
  if (plan.has_text === true) chips.content = 'yes'
  if (plan.has_text === false) chips.content = 'no'
  if (plan.include_folders?.[0]) chips.folder = plan.include_folders[0]
  if (plan.date_after) chips.dateAfter = plan.date_after.slice(0, 10)
  if (plan.date_before) chips.dateBefore = plan.date_before.slice(0, 10)
  if (plan.date_after || plan.date_before) chips.time = 'custom'
  return chips
}

export function planPills(plan: SearchPlanSummary): { key: string; label: string }[] {
  const pills: { key: string; label: string }[] = []
  for (const phrase of plan.exact_phrases ?? []) {
    pills.push({ key: `exact:${phrase}`, label: `"${phrase}"` })
  }
  for (const word of plan.include_words ?? []) {
    pills.push({ key: `inc:${word}`, label: `+${word}` })
  }
  for (const word of plan.exclude_words ?? []) {
    pills.push({ key: `exc:${word}`, label: `-${word}` })
  }
  for (const folder of plan.include_folders ?? []) {
    pills.push({ key: `in:${folder}`, label: `In ${folder}` })
  }
  for (const folder of plan.exclude_folders ?? []) {
    pills.push({ key: `out:${folder}`, label: `Not ${folder}` })
  }
  if (plan.date_after && plan.date_before) {
    pills.push({ key: 'date', label: `${plan.date_after.slice(0, 10)} to ${plan.date_before.slice(0, 10)}` })
  } else if (plan.date_after) {
    pills.push({ key: 'after', label: `After ${plan.date_after.slice(0, 10)}` })
  } else if (plan.date_before) {
    pills.push({ key: 'before', label: `Before ${plan.date_before.slice(0, 10)}` })
  }
  if (plan.has_text === true) pills.push({ key: 'text', label: 'With text' })
  if (plan.has_text === false) pills.push({ key: 'visual', label: 'Images only' })
  if (plan.match === 'strict') pills.push({ key: 'match', label: 'Close match' })
  if (plan.match === 'broad') pills.push({ key: 'match', label: 'Broad' })
  if (plan.vibe_text) pills.push({ key: 'vibe', label: plan.vibe_text })
  return pills
}

export function visibleFolders(collections: CollectionSummary[], max = 6) {
  return collections.slice(0, max)
}
