import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDomain, parseDomainInput, prepareImport, createRecord } from '../js/domainManager.js';
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

test('pasted tables keep source tags separate from review output', () => {
  const pasted = 'reg_domain\tlabel\tComment\ttraffic_type\tmass_retailer\tdevice_traffic_risk\tlocal\tiab_id\tiab_tier1\tiab_tier2\nexample.com\tExisting label\tExisting note\tignored\tno\tlow\tfalse\t42\tNews\tLocal news\nsecond.com\t\t\tignored\t\t\t\t\tShopping\t';
  const { accepted, invalid } = prepareImport(pasted);
  assert.deepEqual(invalid, []);
  assert.equal(accepted.length, 2);
  assert.deepEqual(accepted[0].source, { label: 'Existing label', newLabel: '', comment: 'Existing note', tier1: 'News', tier2: 'Local news' });
  const record = createRecord(accepted[0]);
  assert.equal(record.label, 'Existing label');
  assert.equal(record.comment, '');
  assert.equal(isReviewed(record), false);
  assert.equal(toTSV([record]), 'reg_domain\told_label\tnew_label\tcomment\r\nexample.com\tExisting label\tExisting label\t');
  const restored = validateSession({ ...emptySession(), domains: [record] });
  assert.deepEqual(restored.domains[0].source, record.source);
  assert.deepEqual(parseDomainInput('| domain | lab_tier1 | lab_tier2 |\n| --- | --- | --- |\n| shop.com | Retail | Apparel |').valid[0].source, { label: '', newLabel: '', comment: '', tier1: 'Retail', tier2: 'Apparel' });
  assert.deepEqual(parseDomainInput('reg_domain,Comment,iab_tier1\nnews.com,"Line one\nLine two, with comma",Media').valid[0].source, { label: '', newLabel: '', comment: 'Line one\nLine two, with comma', tier1: 'Media', tier2: '' });
});

test('headerless ten-column paste keeps the first domain and IAB tiers', () => {
  const pasted = '| veo.com            | relevant |   | web | FALSE | FALSE | FALSE | IAB089 | Technology & Computing | Consumer Electronics |\n| ------------------ | -------- | - | --- | ----- | ----- | ----- | ------ | ---------------------- | -------------------- |\n| clicks.tech        | relevant |   | web | FALSE | FALSE | FALSE | IAB089 | Technology & Computing | Consumer Electronics |\n| soundguys.com      | relevant |   | web | FALSE | FALSE | FALSE | IAB089 | Technology & Computing | Consumer Electronics |\n| recellexchange.com | relevant |   | web | FALSE | FALSE | FALSE | IAB089 | Technology & Computing | Consumer Electronics |';
  const result = prepareImport(pasted);
  assert.deepEqual(result.invalid, []);
  assert.deepEqual(result.accepted.map(row => row.hostname), ['veo.com', 'clicks.tech', 'soundguys.com', 'recellexchange.com']);
  assert.deepEqual(result.accepted[0].source, { label: 'relevant', newLabel: '', comment: '', tier1: 'Technology & Computing', tier2: 'Consumer Electronics' });
  assert.deepEqual(createRecord(result.accepted[0]).source, result.accepted[0].source);
  assert.deepEqual(parseDomainInput('veo.com\trelevant\t\tweb\tFALSE\tFALSE\tFALSE\tIAB089\tTechnology & Computing\tConsumer Electronics').valid[0].source, result.accepted[0].source);
});

test('old label stays unchanged while new label defaults or uses pasted value', () => {
  const pasted = 'reg_domain\told_label\tnew_label\tComment\ttraffic_type\tmass_retailer\tdevice_traffic_risk\tlocal\tiab_id\tiab_tier1\tiab_tier2\nveo.com\trelevant\t\t\tweb\tFALSE\tFALSE\tFALSE\tIAB089\tTechnology & Computing\tConsumer Electronics\nclicks.tech\tpartial\tNot relevant\t\tweb\tFALSE\tFALSE\tFALSE\tIAB089\tTechnology & Computing\tConsumer Electronics';
  const records = prepareImport(pasted).accepted.map(createRecord);
  assert.equal(records[0].source.label, 'relevant');
  assert.equal(records[0].source.newLabel, '');
  assert.equal(records[0].label, 'Relevant');
  assert.equal(records[1].source.label, 'partial');
  assert.equal(records[1].label, 'Not relevant');
  records[0].label = 'Partial';
  assert.equal(toTSV(records), 'reg_domain\told_label\tnew_label\tcomment\r\nveo.com\trelevant\tPartial\t\r\nclicks.tech\tpartial\tNot relevant\t');
  assert.deepEqual(validateSession({ ...emptySession(), domains: records }).domains.map(row => row.source.label), ['relevant', 'partial']);
  const headerless = '| veo.com | relevant | | | web | FALSE | FALSE | FALSE | IAB089 | Technology & Computing | Consumer Electronics |';
  assert.deepEqual(parseDomainInput(headerless).valid[0].source, { label: 'relevant', newLabel: '', comment: '', tier1: 'Technology & Computing', tier2: 'Consumer Electronics' });
});

test('review status and statistics distinguish visited, relevant, and reviewed', () => {
  const records = [
    { visited: true, label: 'Relevant', comment: '' },
    { visited: true, label: 'Partial', comment: '' },
    { visited: false, label: 'Other', comment: 'Needs follow-up' },
    { visited: true, label: '', comment: 'A note' }
  ];
  assert.deepEqual(records.map(isReviewed), [true, true, true, false]);
  assert.deepEqual(statistics(records), { total: 4, visited: 3, unvisited: 1, relevant: 1, reviewed: 3, pending: 1 });
  for (const label of ['Partial','Not relevant','Sign in required','Site not reachable']) assert.equal(isReviewed({ label, comment: ' ' }), true);
});

test('CSV and TSV retain order and escape quotes, tabs, and line breaks', () => {
  const rows = [{ hostname: 'one.com', label: 'Relevant', comment: 'A, "quoted"\nline' }, { hostname: 'two.com', label: '', comment: 'tab\there' }];
  assert.equal(toCSV(rows), '\ufeffreg_domain,old_label,new_label,comment\r\none.com,,Relevant,"A, ""quoted""\nline"\r\ntwo.com,,Relevant,tab\there');
  assert.equal(toTSV(rows), 'reg_domain\told_label\tnew_label\tcomment\r\none.com\t\tRelevant\t"A, ""quoted""\nline"\r\ntwo.com\t\tRelevant\t"tab\there"');
  assert.equal(toTSV(rows, false), 'one.com\t\tRelevant\t"A, ""quoted""\nline"\r\ntwo.com\t\tRelevant\t"tab\there"');
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

test('older Partial labels migrate without losing review data', () => {
  const session = emptySession();
  const base = { id: 'legacy', input: 'legacy.com', hostname: 'legacy.com', url: 'https://legacy.com/', visited: true, lastVisited: null, comment: 'Useful but incomplete', reviewed: true };
  for (const oldLabel of ['Partially relevant', 'Partially relavant', 'Partially']) {
    const migrated = validateSession({ ...session, domains: [{ ...base, label: oldLabel }] });
    assert.equal(migrated.domains[0].label, 'Partial');
    assert.equal(migrated.domains[0].comment, base.comment);
    assert.equal(migrated.domains[0].reviewed, true);
    assert.match(toCSV(migrated.domains), /legacy.com,,Partial,Useful but incomplete/);
  }
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
