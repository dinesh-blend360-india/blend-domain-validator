import { normalizeLabel } from './validation.js';

export function rowsForExport(domains) { return [['Domain', 'Label', 'Comment'], ...domains.map(d => [d.hostname, normalizeLabel(d.label), d.comment])]; }
export function toTSV(domains, includeHeader = true) { const rows = rowsForExport(domains); return (includeHeader ? rows : rows.slice(1)).map(row => row.map(tsvCell).join('\t')).join('\r\n'); }
function tsvCell(value) { const string = String(value); return /[\t\r\n"]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string; }
export function toCSV(domains) { return '\ufeff' + rowsForExport(domains).map(row => row.map(csvCell).join(',')).join('\r\n'); }
function csvCell(value) { const string = String(value); return /[,"\r\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string; }
export function downloadText(text, type, filename) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export function datedFilename(prefix, extension) { return `${prefix}-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.${extension}`; }
