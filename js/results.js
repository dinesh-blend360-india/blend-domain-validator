import { rowsForExport } from './export.js';
import { statistics } from './validation.js';

export function renderResults(domains, body, summary) {
  const { total, reviewed } = statistics(domains);
  summary.textContent = `${total} domain${total === 1 ? '' : 's'} · ${reviewed} reviewed`;
  const fragment = document.createDocumentFragment();
  if (!total) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.className = 'results-empty';
    cell.textContent = 'No results yet. Import domains to begin.';
    row.append(cell);
    fragment.append(row);
  } else {
    for (const fields of rowsForExport(domains).slice(1)) {
      const row = document.createElement('tr');
      for (const value of fields) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      }
      fragment.append(row);
    }
  }
  body.replaceChildren(fragment);
}
