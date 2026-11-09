export const LABELS = ['Relevant', 'Partial', 'Not relevant', 'Sign in required', 'Site not reachable'];
export const LEGACY_LABELS = ['Site does not exist', 'Other'];
export function normalizeLabel(label) {
  if (['Partially relevant', 'Partially relavant', 'Partially'].includes(label)) return 'Partial';
  if (label === 'Sign-in required') return 'Sign in required';
  return label;
}
export function isReviewed(record) { return record.reviewed !== false && [...LABELS, ...LEGACY_LABELS].includes(normalizeLabel(record.label)); }
export function statistics(domains) {
  const total = domains.length;
  const visited = domains.reduce((n, d) => n + Number(d.visited), 0);
  const relevant = domains.reduce((n, d) => n + Number(d.label === 'Relevant'), 0);
  const reviewed = domains.reduce((n, d) => n + Number(isReviewed(d)), 0);
  return { total, visited, unvisited: total - visited, relevant, reviewed, pending: total - reviewed };
}
