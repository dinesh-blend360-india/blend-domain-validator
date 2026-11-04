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
  const entries = String(text).split(/[\r\n,;\t]+/).map(s => s.trim()).filter(Boolean);
  const valid = [], invalid = [];
  for (const entry of entries) {
    const domain = normalizeDomain(entry);
    if (domain) valid.push(domain);
    else invalid.push(entry);
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
  return { id: crypto.randomUUID(), input: domain.input, hostname: domain.hostname, url: domain.url, visited: false, lastVisited: null, label: '', comment: '', reviewed: false };
}
