import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDomain, parseDomainInput, prepareImport } from '../js/domainManager.js';
import { isReviewed, statistics } from '../js/validation.js';
import { emptySession, validateSession, saveSession, loadSession, STORAGE_KEY } from '../js/storage.js';
import { toCSV, toTSV } from '../js/export.js';

test('normalizes hosts and full URLs while preserving paths and protocol', () => {
  assert.deepEqual(normalizeDomain(' "WWW.Example.com/" '), { input: 'WWW.Example.com/', hostname: 'www.example.com', url: 'https://www.example.com/' });
  assert.deepEqual(normalizeDomain('http://Sub.Example.com/path?q=1'), { input: 'http://Sub.Example.com/path?q=1', hostname: 'sub.example.com', url: 'http://sub.example.com/path?q=1' });
  for (const bad of ['not a domain', 'https://', 'ftp://example.com', 'https://user:pass@example.com', 'a..com', 'http://example.com evil']) assert.equal(normalizeDomain(bad), null, bad);
});

test('parses lines, commas, semicolons, and Excel tabs; reports invalid entries', () => {
  const result = parseDomainInput('one.com, two.org;https://three.net/path\tfour.io\ninvalid value');
  assert.equal(result.valid.length, 4);
  assert.deepEqual(result.invalid, ['invalid value']);
});

test('detects duplicates within a batch and against existing records', () => {
  const existing = [{ hostname: 'one.com' }];
  const unique = prepareImport('ONE.com\ntwo.com\nTWO.COM', existing, false);
  assert.equal(unique.duplicates, 2); assert.deepEqual(unique.accepted.map(x => x.hostname), ['two.com']);
  const retained = prepareImport('ONE.com\ntwo.com\nTWO.COM', existing, true);
  assert.equal(retained.duplicates, 2); assert.equal(retained.accepted.length, 3);
});

test('review status and statistics distinguish visited, relevant, and reviewed', () => {
  const records = [
    { visited: true, label: 'Relevant', comment: '' },
    { visited: true, label: 'Partially relevant', comment: '' },
    { visited: false, label: 'Other', comment: 'Needs follow-up' },
    { visited: true, label: '', comment: 'A note' }
  ];
  assert.deepEqual(records.map(isReviewed), [true, false, true, false]);
  assert.deepEqual(statistics(records), { total: 4, visited: 3, unvisited: 1, relevant: 1, reviewed: 2, pending: 2 });
  for (const label of ['Partially relevant','Site not reachable','Sign-in required','Site does not exist','Other']) assert.equal(isReviewed({ label, comment: ' ' }), false);
});

test('CSV and TSV retain order and escape quotes, tabs, and line breaks', () => {
  const rows = [{ hostname: 'one.com', label: 'Relevant', comment: 'A, "quoted"\nline' }, { hostname: 'two.com', label: '', comment: 'tab\there' }];
  assert.equal(toCSV(rows), '\ufeffDomain,Label,Comment\r\none.com,Relevant,"A, ""quoted""\nline"\r\ntwo.com,,tab\there');
  assert.equal(toTSV(rows), 'Domain\tLabel\tComment\r\none.com\tRelevant\t"A, ""quoted""\nline"\r\ntwo.com\t\t"tab\there"');
});

test('storage round-trip, corrupted JSON, and backup validation', () => {
  const map = new Map(); globalThis.localStorage = { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) };
  const session = emptySession(); session.domains.push({ id: 'a', input: 'one.com', hostname: 'one.com', url: 'https://one.com/', visited: true, lastVisited: null, label: 'Relevant', comment: '', reviewed: true }); session.currentId = 'a';
  saveSession(session); assert.equal(loadSession().session.domains[0].hostname, 'one.com');
  map.set(STORAGE_KEY, '{bad'); assert.equal(loadSession().corrupt, true); assert.equal(map.get(STORAGE_KEY), '{bad');
  globalThis.localStorage.getItem = () => { throw Error('Storage unavailable'); };
  assert.equal(loadSession().corrupt, true);
  assert.throws(() => validateSession({ ...session, version: 99 }), /Unsupported/);
  assert.throws(() => validateSession({ ...session, domains: [{ ...session.domains[0], url: 'javascript:alert(1)' }] }), /Invalid URL/);
  delete globalThis.localStorage;
});

test('handles a thousand records without changing order or review counts', () => {
  const input = Array.from({ length: 1000 }, (_, i) => `site${i}.example.com`).join('\n');
  const result = prepareImport(input);
  assert.equal(result.accepted.length, 1000);
  assert.equal(result.accepted[999].hostname, 'site999.example.com');
  const records = result.accepted.map((domain, i) => ({ ...domain, visited: i < 300, label: i < 100 ? 'Relevant' : '', comment: '' }));
  assert.deepEqual(statistics(records), { total: 1000, visited: 300, unvisited: 700, relevant: 100, reviewed: 100, pending: 900 });
  assert.equal(toCSV(records).split('\r\n').length, 1001);
});
