export const LABELS = ['Relevant', 'Partial', 'Not relevant', 'Sign in required', 'Site not reachable'];
export const LEGACY_LABELS = ['Site does not exist', 'Other'];
export function normalizeLabel(label) {
  const value = String(label ?? '').trim();
  const aliases = {
    relevant: 'Relevant', partial: 'Partial', partially: 'Partial', 'partially relevant': 'Partial', 'partially relavant': 'Partial',
    'not relevant': 'Not relevant', 'not relavant': 'Not relevant', 'sign in required': 'Sign in required', 'sign-in required': 'Sign in required',
    'site not reachable': 'Site not reachable', 'site not rechable': 'Site not reachable', 'site does not exist': 'Site does not exist', other: 'Other'
  };
  return aliases[value.toLowerCase()] ?? value;
}
export function isAllowedLabel(label, source) { return [...LABELS, ...LEGACY_LABELS].includes(label) || [source?.label, source?.newLabel].some(value => value && normalizeLabel(value) === label); }
export function isReviewed(record) { return record.reviewed !== false && isAllowedLabel(normalizeLabel(record.label), record.source); }
export function statistics(domains) {
  const total = domains.length;
  const visited = domains.reduce((n, d) => n + Number(d.visited), 0);
  const relevant = domains.reduce((n, d) => n + Number(d.label === 'Relevant'), 0);
  const reviewed = domains.reduce((n, d) => n + Number(isReviewed(d)), 0);
  return { total, visited, unvisited: total - visited, relevant, reviewed, pending: total - reviewed };
}
