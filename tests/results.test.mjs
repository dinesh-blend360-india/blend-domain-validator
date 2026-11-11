import test from 'node:test';
import assert from 'node:assert/strict';
import { renderResults } from '../js/results.js';

class FakeNode {
  constructor(tagName) { this.tagName = tagName; this.children = []; this.textContent = ''; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children.flatMap(child => child.tagName === 'fragment' ? child.children : [child]); }
}

test('results preview shows all records in import order with four columns', () => {
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: name => new FakeNode(name), createDocumentFragment: () => new FakeNode('fragment') };
  try {
    const body = new FakeNode('tbody'), summary = new FakeNode('p');
    renderResults([
      { hostname: 'first.example.com', source: { label: 'relevant' }, label: 'Relevant', comment: '<reviewed> yes', visited: true },
      { hostname: 'second.example.com', label: '', comment: '', visited: false }
    ], body, summary);
    assert.equal(summary.textContent, '2 domains · 1 reviewed');
    assert.deepEqual(body.children.map(row => row.children.map(cell => cell.textContent)), [
      ['first.example.com', 'relevant', 'Relevant', '<reviewed> yes'],
      ['second.example.com', '', 'Relevant', '']
    ]);
  } finally { globalThis.document = previousDocument; }
});

test('results preview explains an empty session', () => {
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: name => new FakeNode(name), createDocumentFragment: () => new FakeNode('fragment') };
  try {
    const body = new FakeNode('tbody'), summary = new FakeNode('p');
    renderResults([], body, summary);
    assert.equal(summary.textContent, '0 domains · 0 reviewed');
    assert.equal(body.children[0].children[0].textContent, 'No results yet. Import domains to begin.');
    assert.equal(body.children[0].children[0].colSpan, 4);
  } finally { globalThis.document = previousDocument; }
});
