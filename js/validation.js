export const LABELS = ['Relevant', 'Partial', 'Site not reachable', 'Sign-in required', 'Site does not exist', 'Other'];
export function normalizeLabel(label) { return ['Partially relevant', 'Partially relavant', 'Partially'].includes(label) ? 'Partial' : label; }
export function requiresComment(label) { return Boolean(label) && label !== 'Relevant'; }
export function isReviewed(record) { const label = normalizeLabel(record.label); return LABELS.includes(label) && (!requiresComment(label) || Boolean(record.comment.trim())); }
export function statistics(domains) {
  const total = domains.length;
  const visited = domains.reduce((n, d) => n + Number(d.visited), 0);
  const relevant = domains.reduce((n, d) => n + Number(d.label === 'Relevant'), 0);
  const reviewed = domains.reduce((n, d) => n + Number(isReviewed(d)), 0);
  return { total, visited, unvisited: total - visited, relevant, reviewed, pending: total - reviewed };
}
