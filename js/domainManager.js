export function normalizeDomain(raw) {
  const input = String(raw ?? '').trim().replace(/^["'“”]+|["'“”]+$/g, '').trim();
  if (!input || /\s/.test(input)) return null;
  const suppliedProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(input);
  if (suppliedProtocol && !/^https?:\/\//i.test(input)) return null;
  try {
    const url = new URL(suppliedProtocol ? input : `https://${input}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
    if (hostname.length > 253 || !hostname.includes('.') || !hostname.split('.').every(part => /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(part))) return null;
    if (/^\d+(?:\.\d+){3}$/.test(hostname) && hostname.split('.').some(part => +part > 255)) return null;
    url.hostname = hostname;
    url.hash = '';
    return { input, hostname, url: url.href };
  } catch { return null; }
}

export function parseDomainInput(text) {
  const table = parseTable(text);
  if (table) return table;
  const entries = String(text).split(/[\r\n,;\t]+/).map(s => s.trim()).filter(Boolean);
  const valid = [], invalid = [];
  for (const entry of entries) {
    const domain = normalizeDomain(entry);
    if (domain) valid.push(domain);
    else invalid.push(entry);
  }
  return { valid, invalid };
}

function splitRow(line, delimiter) {
  if (delimiter === '|') return line.trim().replace(/^\||\|$/g, '').split('|').map(value => value.trim());
  return parseDelimitedRows(line, delimiter)[0];
}

function parseDelimitedRows(text, delimiter) {
  const rows = [], cells = []; let value = '', quoted = false;
  const cell = () => { cells.push(value.trim()); value = ''; };
  const row = () => { cell(); if (cells.some(Boolean)) rows.push(cells.splice(0)); else cells.length = 0; };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') { value += '"'; i++; }
    else if (char === '"' && (quoted || !value.trim())) quoted = !quoted;
    else if (char === delimiter && !quoted) cell();
    else if ((char === '\r' || char === '\n') && !quoted) { if (char === '\r' && text[i + 1] === '\n') i++; row(); }
    else value += char;
  }
  if (value || cells.length) row();
  return rows;
}

function parseTable(text) {
  const lines = String(text).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) return null;
  const first = lines[0];
  const delimiter = first.includes('\t') ? '\t' : first.startsWith('|') ? '|' : ',';
  const firstCells = splitRow(first, delimiter);
  const headings = firstCells.map(value => value.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const domainIndex = headings.findIndex(value => ['regdomain', 'domain'].includes(value));
  const headerless = domainIndex < 0 && firstCells.length === 10 && normalizeDomain(firstCells[0]) && !normalizeDomain(firstCells[1]);
  if (domainIndex < 0 && !headerless) return null;
  const index = names => headings.findIndex(value => names.includes(value));
  const columns = headerless
    ? { domain: 0, label: 1, comment: 2, tier1: 8, tier2: 9 }
    : { domain: domainIndex, label: index(['label']), comment: index(['comment']), tier1: index(['iabtier1', 'labtier1']), tier2: index(['iabtier2', 'labtier2']) };
  const valid = [], invalid = [];
  const rows = delimiter === '|' ? lines.slice(headerless ? 0 : 1).filter(line => !/^\|?[\s:|-]+\|?$/.test(line)).map(line => splitRow(line, delimiter)) : parseDelimitedRows(text, delimiter).slice(headerless ? 0 : 1);
  for (const cells of rows) {
    const raw = cells[columns.domain] ?? '';
    const domain = normalizeDomain(raw);
    if (!domain) { invalid.push(raw || '(empty domain)'); continue; }
    const get = column => column < 0 ? '' : cells[column] ?? '';
    valid.push({ ...domain, source: { label: get(columns.label), comment: get(columns.comment), tier1: get(columns.tier1), tier2: get(columns.tier2) } });
  }
  return { valid, invalid };
}

export function prepareImport(text, existing = [], keepDuplicates = false) {
  const { valid, invalid } = parseDomainInput(text);
  const seen = new Set(existing.map(record => record.hostname.toLowerCase()));
  const accepted = [];
  let duplicates = 0;
  for (const domain of valid) {
    const key = domain.hostname.toLowerCase();
    if (seen.has(key)) duplicates++;
    if (!seen.has(key) || keepDuplicates) accepted.push(domain);
    seen.add(key);
  }
  return { accepted, invalid, duplicates, validCount: valid.length };
}

export function createRecord(domain) {
  return { id: crypto.randomUUID(), input: domain.input, hostname: domain.hostname, url: domain.url, source: domain.source ?? null, visited: false, lastVisited: null, label: 'Relevant', comment: '', reviewed: false };
}
