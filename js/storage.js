import { isAllowedLabel, isReviewed, normalizeLabel } from './validation.js';
import { normalizeDomain } from './domainManager.js';

export const STORAGE_KEY = 'domain-validator.session.v1';
export const SCHEMA_VERSION = 1;
export function emptySession(ui = {}) { const now = new Date().toISOString(); return { version: SCHEMA_VERSION, createdAt: now, updatedAt: now, currentId: null, domains: [], ui: { leftOpen: true, rightOpen: true, leftWidth: 296, rightWidth: 314, ...ui } }; }
export function saveSession(session) {
  session.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}
export function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { session: emptySession(), error: null };
    return { session: validateSession(JSON.parse(raw)), error: null };
  }
  catch (error) { return { session: emptySession(), error: `Stored session could not be read (${error.message}). Your data was left untouched. Restore a backup or clear the session to start over.`, corrupt: true }; }
}
export function clearSession() { localStorage.removeItem(STORAGE_KEY); }
export function validateSession(data) {
  if (!data || typeof data !== 'object' || data.version !== SCHEMA_VERSION || !Array.isArray(data.domains) || typeof data.ui !== 'object' || !data.ui) throw Error('Unsupported or invalid backup format');
  if (data.domains.length > 100000) throw Error('Backup contains too many records');
  const ids = new Set();
  const domains = data.domains.map((record, index) => {
    const source = record?.source == null ? null : record.source;
    if (source && (typeof source !== 'object' || ['label', 'comment', 'tier1', 'tier2'].some(key => typeof source[key] !== 'string' || source[key].length > 100000) || (source.newLabel !== undefined && (typeof source.newLabel !== 'string' || source.newLabel.length > 100000)))) throw Error(`Invalid imported data at position ${index + 1}`);
    const label = normalizeLabel(record?.label) || 'Relevant';
    if (!record || typeof record !== 'object' || typeof record.id !== 'string' || !record.id || ids.has(record.id) || typeof record.input !== 'string' || typeof record.url !== 'string' || typeof record.hostname !== 'string' || typeof record.label !== 'string' || typeof record.comment !== 'string' || record.comment.length > 100000 || typeof record.visited !== 'boolean' || !isAllowedLabel(label, source)) throw Error(`Invalid record at position ${index + 1}`);
    ids.add(record.id);
    const parsed = normalizeDomain(record.url);
    if (!parsed || parsed.hostname !== record.hostname) throw Error(`Invalid URL at position ${index + 1}`);
    const clean = { id: record.id, input: record.input, hostname: record.hostname, url: parsed.url, source: source ? { label: source.label, newLabel: source.newLabel ?? '', comment: source.comment, tier1: source.tier1, tier2: source.tier2 } : null, visited: record.visited, lastVisited: typeof record.lastVisited === 'string' ? record.lastVisited : null, label, comment: record.comment, reviewed: record.reviewed === true };
    clean.reviewed = isReviewed(clean);
    return clean;
  });
  const ui = { leftOpen: data.ui.leftOpen !== false, rightOpen: data.ui.rightOpen !== false, leftWidth: clamp(data.ui.leftWidth, 220, 500, 296), rightWidth: clamp(data.ui.rightWidth, 240, 500, 314) };
  return { version: SCHEMA_VERSION, createdAt: typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString(), updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(), currentId: ids.has(data.currentId) ? data.currentId : null, domains, ui };
}
function clamp(value, min, max, fallback) { return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback; }
