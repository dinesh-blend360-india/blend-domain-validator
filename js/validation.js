export const LABELS = ['Relevant', 'Partially relevant', 'Site not reachable', 'Sign-in required', 'Site does not exist', 'Other'];
export function requiresComment(label) { return Boolean(label) && label !== 'Relevant'; }
export function isReviewed(record) { return LABELS.includes(record.label) && (!requiresComment(record.label) || Boolean(record.comment.trim())); }
export function statistics(domains) {
  const total = domains.length;
  const visited = domains.reduce((n, d) => n + Number(d.visited), 0);
  const relevant = domains.reduce((n, d) => n + Number(d.label === 'Relevant'), 0);
  const reviewed = domains.reduce((n, d) => n + Number(isReviewed(d)), 0);
  return { total, visited, unvisited: total - visited, relevant, reviewed, pending: total - reviewed };
}
