import { prepareImport, createRecord } from './domainManager.js';
import { isReviewed, statistics } from './validation.js';
import { emptySession, loadSession, saveSession, clearSession, validateSession } from './storage.js';
import { toTSV, toCSV, downloadText, datedFilename } from './export.js';
import { renderResults } from './results.js';

const $ = id => document.getElementById(id);
const elements = Object.fromEntries(['workspace','left-panel','right-panel','left-toggle','right-toggle','domains-toggle','left-resizer','right-resizer','previous','next','position','jump','stat-total','stat-visited','stat-unvisited','stat-relevant','stat-reviewed','view-results','results-dialog','results-summary','results-body','results-copy-header','results-copy-no-header','results-download','results-close','results-close-icon','fullscreen','domain-input','keep-duplicates','append','replace','import-message','list-count','search','filter','domain-list','copy','csv','backup','restore','restore-file','reset','address-text','open-external','hint-external','load-status','preview','preview-overlay','frame-hint','empty-import','import-details','current-domain','review-badge','source-details','source-label','source-comment','source-tier1','source-tier2','label','comment','required-marker','comment-optional','comment-help','save-status','save-review','validation-message','confirm-dialog','dialog-title','dialog-message','dialog-confirm','dialog-cancel','toast'].map(id => [id.replaceAll('-', '_'), $(id)]));
const stored = loadSession();
let session = stored.session;
let locked = Boolean(stored.corrupt);
let focusMode = false;
let frameTimer = null;
let toastTimer = null;
let dialogResolver = null;

function currentIndex() { return session.domains.findIndex(d => d.id === session.currentId); }
function current() { return session.domains[currentIndex()] ?? null; }
function persist() {
  if (locked) { showSave('Save failed', 'failed'); showToast('Stored session is damaged. Export or restore a backup, or clear the session.'); return false; }
  showSave('Saving…');
  try { saveSession(session); showSave('Saved', 'saved'); return true; }
  catch (error) { showSave('Save failed', 'failed'); showToast(`Could not save to this browser: ${error.message}. Export a backup now.`); return false; }
}
function showSave(message, kind = '') { elements.save_status.textContent = message; elements.save_status.className = kind; }
function showToast(message) { elements.toast.textContent = message; elements.toast.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => elements.toast.classList.remove('visible'), 4500); }
function setMessage(node, message, kind = '') { node.textContent = message; node.className = `message ${kind}`; }
function confirmAction(title, message, confirmText = 'Confirm') {
  if (dialogResolver) return Promise.resolve(false);
  elements.dialog_title.textContent = title; elements.dialog_message.textContent = message; elements.dialog_confirm.textContent = confirmText;
  elements.confirm_dialog.showModal();
  return new Promise(resolve => { dialogResolver = resolve; });
}
function closeDialog(result) { if (!dialogResolver) return; const resolve = dialogResolver; dialogResolver = null; elements.confirm_dialog.close(); resolve(result); }
elements.dialog_confirm.addEventListener('click', () => closeDialog(true));
elements.dialog_cancel.addEventListener('click', () => closeDialog(false));
elements.confirm_dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(false); });
elements.view_results.addEventListener('click', () => { renderResults(session.domains, elements.results_body, elements.results_summary); elements.results_dialog.showModal(); });
for (const button of [elements.results_close, elements.results_close_icon]) button.addEventListener('click', () => elements.results_dialog.close());
elements.results_dialog.addEventListener('close', () => elements.view_results.focus());

function fitPanelWidths() {
  if (window.innerWidth <= 800) {
    if (session.ui.leftOpen && session.ui.rightOpen) session.ui.rightOpen = false;
    return;
  }
  const available = window.innerWidth - 290;
  const left = session.ui.leftOpen ? session.ui.leftWidth : 34;
  const right = session.ui.rightOpen ? session.ui.rightWidth : 34;
  const overflow = left + right - available;
  if (overflow <= 0) return;
  if (session.ui.leftOpen) session.ui.leftWidth = Math.max(220, session.ui.leftWidth - overflow);
  const remaining = (session.ui.leftOpen ? session.ui.leftWidth : 34) + right - available;
  if (remaining > 0 && session.ui.rightOpen) session.ui.rightWidth = Math.max(240, session.ui.rightWidth - remaining);
}
function maxPanelWidth(side) {
  const other = side === 'left' ? 'right' : 'left';
  const otherWidth = session.ui[`${other}Open`] ? session.ui[`${other}Width`] : 34;
  return Math.max(side === 'left' ? 220 : 240, Math.min(500, window.innerWidth - otherWidth - 290));
}
function applyPanelState() {
  fitPanelWidths();
  const { leftOpen, rightOpen, leftWidth, rightWidth } = session.ui;
  document.documentElement.style.setProperty('--left', `${leftOpen ? leftWidth : 34}px`);
  document.documentElement.style.setProperty('--right', `${rightOpen ? rightWidth : 34}px`);
  elements.workspace.classList.toggle('left-collapsed', !leftOpen);
  elements.workspace.classList.toggle('right-collapsed', !rightOpen);
  elements.workspace.classList.toggle('focus-mode', focusMode);
  elements.left_panel.classList.toggle('collapsed', !leftOpen);
  elements.right_panel.classList.toggle('collapsed', !rightOpen);
  for (const [toggle, open, name] of [[elements.left_toggle, leftOpen, 'domain list'], [elements.domains_toggle, leftOpen, 'domain list'], [elements.right_toggle, rightOpen, 'validation panel']]) {
    const visible = open && !focusMode;
    const action = `${visible ? 'Collapse' : 'Expand'} ${name}`;
    toggle.setAttribute('aria-label', action); toggle.setAttribute('aria-expanded', String(visible)); toggle.title = action;
  }
  elements.left_toggle.textContent = leftOpen ? '‹' : '›';
  elements.right_toggle.textContent = rightOpen ? '›' : '‹';
  elements.fullscreen.textContent = focusMode ? 'Exit focus view' : 'Focus view';
}
function togglePanel(side) { const key = side === 'left' ? 'leftOpen' : 'rightOpen'; if (focusMode) { focusMode = false; session.ui[key] = true; } else session.ui[key] = !session.ui[key]; if (window.innerWidth <= 800 && session.ui[key]) session.ui[side === 'left' ? 'rightOpen' : 'leftOpen'] = false; applyPanelState(); persist(); }
elements.left_toggle.addEventListener('click', () => togglePanel('left'));
elements.domains_toggle.addEventListener('click', () => togglePanel('left'));
elements.right_toggle.addEventListener('click', () => togglePanel('right'));
elements.fullscreen.addEventListener('click', () => { focusMode = !focusMode; applyPanelState(); });
function setupResizer(node, side) {
  node.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    node.setPointerCapture(event.pointerId); node.classList.add('dragging');
    const start = event.clientX, initial = session.ui[`${side}Width`];
    function move(e) { const change = side === 'left' ? e.clientX - start : start - e.clientX; session.ui[`${side}Width`] = Math.max(side === 'left' ? 220 : 240, Math.min(maxPanelWidth(side), initial + change)); applyPanelState(); }
    function end() { node.removeEventListener('pointermove', move); node.removeEventListener('pointerup', end); node.removeEventListener('pointercancel', end); node.classList.remove('dragging'); persist(); }
    node.addEventListener('pointermove', move); node.addEventListener('pointerup', end); node.addEventListener('pointercancel', end);
  });
  node.addEventListener('keydown', event => { if (!['ArrowLeft','ArrowRight'].includes(event.key)) return; event.preventDefault(); const delta = (event.key === 'ArrowRight' ? 10 : -10) * (side === 'left' ? 1 : -1); session.ui[`${side}Width`] = Math.max(side === 'left' ? 220 : 240, Math.min(maxPanelWidth(side), session.ui[`${side}Width`] + delta)); applyPanelState(); persist(); });
}
setupResizer(elements.left_resizer, 'left'); setupResizer(elements.right_resizer, 'right');
window.addEventListener('resize', applyPanelState);

function renderStats() { const stats = statistics(session.domains); for (const key of ['total','visited','unvisited','relevant','reviewed']) elements[`stat_${key}`].textContent = stats[key]; elements.list_count.textContent = `${stats.total} record${stats.total === 1 ? '' : 's'}`; }
function filterMatches(record) { const filter = elements.filter.value; if (!record.hostname.includes(elements.search.value.trim().toLowerCase())) return false; if (filter === 'all') return true; if (filter === 'unvisited') return !record.visited; if (filter === 'visited') return record.visited; if (filter === 'reviewed') return isReviewed(record); if (filter === 'unreviewed') return !isReviewed(record); return record.label === filter; }
function renderList() {
  const fragment = document.createDocumentFragment(); let shown = 0;
  session.domains.forEach((record, index) => {
    if (!filterMatches(record)) return; shown++;
    const item = document.createElement('div'); item.className = `domain-item${record.visited ? ' visited' : ''}${record.id === session.currentId ? ' active' : ''}`; item.dataset.id = record.id; item.setAttribute('role','option'); item.setAttribute('aria-selected', String(record.id === session.currentId)); item.tabIndex = 0;
    const number = document.createElement('span'); number.className = 'number'; number.textContent = String(index + 1).padStart(2, '0');
    const dot = document.createElement('span'); dot.className = 'status-dot'; dot.setAttribute('aria-hidden','true');
    const name = document.createElement('span'); name.className = 'domain-name'; name.textContent = record.hostname;
    item.append(number, dot, name);
    if (isReviewed(record)) { const check = document.createElement('span'); check.className = 'review-check'; check.textContent = '✓'; check.setAttribute('aria-label','Reviewed'); item.append(check); }
    item.setAttribute('aria-label', `${index + 1}: ${record.hostname}, ${record.visited ? 'visited' : 'not visited'}, ${isReviewed(record) ? 'reviewed' : 'not reviewed'}`);
    fragment.append(item);
  });
  elements.domain_list.replaceChildren(fragment);
  if (!shown) { const empty = document.createElement('p'); empty.className = 'empty-list'; empty.textContent = session.domains.length ? 'No domains match this search or filter.' : 'No domains yet. Import a list to begin.'; elements.domain_list.append(empty); }
}
function renderJump() {
  const fragment = document.createDocumentFragment(); const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = 'Jump to domain'; fragment.append(placeholder);
  session.domains.forEach((record, index) => { const option = document.createElement('option'); option.value = record.id; option.textContent = `${String(index + 1).padStart(2,'0')} · ${record.hostname} · ${isReviewed(record) ? 'Reviewed' : record.visited ? 'Visited' : 'Not visited'}`; fragment.append(option); });
  elements.jump.replaceChildren(fragment); elements.jump.value = session.currentId ?? '';
}
function updateJumpStatus() { const record = current(); elements.jump.value = record?.id ?? ''; const option = elements.jump.selectedOptions[0]; if (option && record) option.textContent = `${String(currentIndex()+1).padStart(2,'0')} · ${record.hostname} · ${isReviewed(record) ? 'Reviewed' : record.visited ? 'Visited' : 'Not visited'}`; }
function renderValidation() {
  const record = current();
  elements.current_domain.textContent = record?.hostname ?? 'No domain selected';
  elements.label.disabled = elements.comment.disabled = elements.save_review.disabled = !record || locked;
  const source = record?.source;
  elements.source_details.hidden = !source;
  for (const [key, value] of [['label', source?.label], ['comment', source?.comment], ['tier1', source?.tier1], ['tier2', source?.tier2]]) elements[`source_${key}`].textContent = value || '—';
  elements.label.querySelector('option[data-legacy]')?.remove();
  if (record?.label && ![...elements.label.options].some(option => option.value === record.label)) { const option = document.createElement('option'); option.value = record.label; option.textContent = `${record.label} (older review)`; option.dataset.legacy = 'true'; elements.label.append(option); }
  elements.label.value = record?.label ?? ''; elements.comment.value = record?.comment ?? '';
  updateValidationState();
}
function updateValidationState() {
  const record = current();
  elements.required_marker.hidden = true; elements.comment_optional.textContent = 'Optional';
  elements.comment.classList.remove('invalid'); elements.comment.setAttribute('aria-invalid', 'false');
  elements.comment_help.textContent = record ? 'Leave blank if you have no review comment.' : 'Choose a domain to begin.';
  elements.review_badge.className = `review-badge${record ? isReviewed(record) ? ' reviewed' : ' pending' : ''}`;
  elements.review_badge.textContent = !record ? 'Awaiting import' : isReviewed(record) ? '✓ Reviewed' : 'Not reviewed';
}
function renderNavigation() { const index = currentIndex(), total = session.domains.length; elements.position.textContent = `${index < 0 ? 0 : index + 1} / ${total}`; elements.previous.disabled = index <= 0; elements.next.disabled = index < 0 || index >= total - 1; updateJumpStatus(); }
function browse(record) {
  clearTimeout(frameTimer);
  if (!record) { elements.preview.removeAttribute('src'); elements.preview_overlay.hidden = false; elements.frame_hint.hidden = true; elements.address_text.textContent = 'No website selected'; elements.load_status.textContent = ''; elements.open_external.href = '#'; elements.hint_external.href = '#'; elements.open_external.setAttribute('aria-disabled','true'); return; }
  elements.preview_overlay.hidden = true; elements.address_text.textContent = record.url; elements.open_external.href = record.url; elements.hint_external.href = record.url; elements.open_external.setAttribute('aria-disabled','false'); elements.load_status.textContent = 'Loading…'; elements.frame_hint.hidden = false;
  elements.preview.dataset.url = record.url;
  elements.preview.src = record.url;
  frameTimer = setTimeout(() => { elements.load_status.textContent = 'Still loading? Check preview or open in new tab'; }, 12000);
}
// Browsers fire `load` even when a site refuses embedding, and a cross-origin frame cannot be inspected,
// so this only confirms the frame finished loading. Ignore loads left over from a previously selected domain.
elements.preview.addEventListener('load', () => {
  const record = current();
  if (!record || elements.preview.dataset.url !== record.url) return;
  clearTimeout(frameTimer);
  elements.load_status.textContent = 'Loaded in preview · if blank or refused, use Open in new tab';
});
function renderAll(loadFrame = false) { elements.append.disabled = elements.replace.disabled = locked; applyPanelState(); renderStats(); renderJump(); renderList(); renderNavigation(); renderValidation(); if (loadFrame) browse(current()); }
function selectDomain(id, { loadFrame = true } = {}) {
  const record = session.domains.find(d => d.id === id); if (!record) return;
  session.currentId = id; record.visited = true; record.lastVisited = new Date().toISOString();
  persist(); renderStats(); renderJump(); renderList(); renderNavigation(); renderValidation(); if (loadFrame) browse(record);
  elements.domain_list.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
}
elements.previous.addEventListener('click', () => { const index = currentIndex(); if (index > 0) selectDomain(session.domains[index - 1].id); });
elements.next.addEventListener('click', () => { const index = currentIndex(); if (index >= 0 && index < session.domains.length - 1) selectDomain(session.domains[index + 1].id); });
elements.jump.addEventListener('change', () => selectDomain(elements.jump.value));
elements.domain_list.addEventListener('click', event => { const item = event.target.closest('.domain-item'); if (item) selectDomain(item.dataset.id); });
elements.domain_list.addEventListener('keydown', event => { if (!['Enter',' '].includes(event.key)) return; const item = event.target.closest('.domain-item'); if (item) { event.preventDefault(); selectDomain(item.dataset.id); } });
elements.search.addEventListener('input', renderList); elements.filter.addEventListener('change', renderList);

async function importDomains(mode) {
  if (locked) { showToast('Stored session is damaged. Restore a backup or clear the session first.'); return; }
  const text = elements.domain_input.value;
  const prepared = prepareImport(text, mode === 'append' ? session.domains : [], elements.keep_duplicates.checked);
  if (!prepared.validCount && !prepared.invalid.length) { setMessage(elements.import_message, 'Paste at least one domain.', 'error'); return; }
  const invalidDetail = prepared.invalid.length ? ` Rejected ${prepared.invalid.length} invalid entr${prepared.invalid.length === 1 ? 'y' : 'ies'}${prepared.invalid.length <= 3 ? `: ${prepared.invalid.join(', ')}` : '.'}` : '';
  if (!prepared.accepted.length) { setMessage(elements.import_message, `No domains added. ${prepared.duplicates} duplicate${prepared.duplicates === 1 ? '' : 's'} found.${invalidDetail}`, 'error'); return; }
  if (mode === 'replace' && session.domains.length) {
    const yes = await confirmAction('Replace the domain list?', `This will remove ${session.domains.length} existing domain records, including labels, comments, and visit history. Export a backup first if you need them.`, 'Replace list'); if (!yes) return;
  }
  const records = prepared.accepted.map(createRecord);
  if (mode === 'replace') { session = emptySession(session.ui); session.domains = records; session.currentId = null; }
  else session.domains.push(...records);
  if (!session.currentId && records.length) { session.currentId = records[0].id; records[0].visited = true; records[0].lastVisited = new Date().toISOString(); }
  const saved = persist(); renderAll(true);
  const duplicateText = `${prepared.duplicates} duplicate${prepared.duplicates === 1 ? '' : 's'} ${elements.keep_duplicates.checked ? 'kept' : 'skipped'}.`;
  setMessage(elements.import_message, `${records.length} imported. ${duplicateText}${invalidDetail}${saved ? '' : ' Save failed; export a backup now.'}`, saved ? 'success' : 'error');
  if (saved) elements.domain_input.value = '';
}
elements.append.addEventListener('click', () => importDomains('append'));
elements.replace.addEventListener('click', () => importDomains('replace'));
elements.empty_import.addEventListener('click', () => { if (!session.ui.leftOpen) togglePanel('left'); elements.import_details.open = true; elements.domain_input.focus(); });

function updateCurrentReview() {
  const record = current(); if (!record || locked) return false;
  record.label = elements.label.value; record.comment = elements.comment.value; record.reviewed = Boolean(record.label);
  const saved = persist(); renderStats(); updateValidationState(); updateJumpStatus();
  const selected = elements.domain_list.querySelector('.active');
  if (selected) { let check = selected.querySelector('.review-check'); if (record.reviewed && !check) { check = document.createElement('span'); check.className = 'review-check'; check.textContent = '✓'; check.setAttribute('aria-label','Reviewed'); selected.append(check); } else if (!record.reviewed) check?.remove(); selected.setAttribute('aria-label', `${currentIndex()+1}: ${record.hostname}, visited, ${record.reviewed ? 'reviewed' : 'not reviewed'}`); }
  if (['reviewed','unreviewed','Relevant','Partial','Not relevant','Sign in required','Site not reachable'].includes(elements.filter.value)) renderList();
  return saved;
}
elements.label.addEventListener('change', () => { updateCurrentReview(); setMessage(elements.validation_message, ''); });
elements.comment.addEventListener('input', () => { updateCurrentReview(); setMessage(elements.validation_message, ''); });
function saveReview() { const record = current(); if (!record || locked) return; const saved = updateCurrentReview(); if (!saved) { setMessage(elements.validation_message, 'Save failed. Export a backup to protect this review.', 'error'); return; } if (isReviewed(record)) { setMessage(elements.validation_message, 'Review complete and saved.', 'success'); showToast('Review saved.'); } else { setMessage(elements.validation_message, 'Select a validation label to complete this review.', 'error'); elements.label.focus(); } }
elements.save_review.addEventListener('click', saveReview);

async function copyResults(includeHeader) { try { await navigator.clipboard.writeText(toTSV(session.domains, includeHeader)); showToast(`Results copied ${includeHeader ? 'with' : 'without'} header.`); } catch { showToast('Clipboard access failed. Use Download CSV instead.'); } }
function downloadResults() { downloadText(toCSV(session.domains), 'text/csv;charset=utf-8', datedFilename('domain-validation', 'csv')); showToast('CSV download started.'); }
elements.copy.addEventListener('click', () => copyResults(true));
elements.results_copy_header.addEventListener('click', () => copyResults(true));
elements.results_copy_no_header.addEventListener('click', () => copyResults(false));
elements.csv.addEventListener('click', downloadResults);
elements.results_download.addEventListener('click', downloadResults);
elements.backup.addEventListener('click', () => { downloadText(JSON.stringify(session, null, 2), 'application/json', datedFilename('blend-domain-validator-backup', 'json')); showToast('Session backup download started.'); });
elements.restore.addEventListener('click', () => elements.restore_file.click());
elements.restore_file.addEventListener('change', async () => {
  const file = elements.restore_file.files?.[0]; elements.restore_file.value = ''; if (!file) return;
  try {
    if (file.size > 50 * 1024 * 1024) throw Error('Backup exceeds 50 MB');
    const parsed = validateSession(JSON.parse(await file.text()));
    const yes = await confirmAction('Restore this backup?', `This backup contains ${parsed.domains.length} domain records. Restoring it will replace the current session and its validation data.`, 'Restore backup'); if (!yes) return;
    saveSession(parsed); session = parsed; locked = false; renderAll(true); showToast('Backup restored.');
  } catch (error) { showToast(`Backup restore failed: ${error.message}`); }
});
elements.reset.addEventListener('click', async () => { const yes = await confirmAction('Clear all session data?', 'This removes the domain list, labels, comments, and visit history from this browser. Export CSV or a JSON backup first if you need your work.', 'Clear all data'); if (!yes) return; try { clearSession(); session = emptySession(session.ui); locked = false; renderAll(true); setMessage(elements.import_message, 'Session cleared. Paste domains to begin.', 'success'); showToast('Session cleared.'); } catch (error) { showToast(`Could not clear session: ${error.message}`); } });

document.addEventListener('keydown', event => {
  if (elements.results_dialog.open || elements.confirm_dialog.open) return;
  if (event.ctrlKey && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'f') { event.preventDefault(); if (focusMode) { focusMode = false; applyPanelState(); } if (!session.ui.leftOpen) togglePanel('left'); elements.search.focus(); elements.search.select(); return; }
  if (event.ctrlKey && event.key === 'Enter') { event.preventDefault(); saveReview(); return; }
  const typing = event.target.matches('input,textarea,select,[contenteditable=true]'); if (typing || event.ctrlKey || event.altKey || event.metaKey || elements.confirm_dialog.open) return;
  if (event.key === 'ArrowLeft') elements.previous.click(); else if (event.key === 'ArrowRight') elements.next.click();
});

if (stored.error) { setMessage(elements.import_message, stored.error, 'error'); showSave('Save failed', 'failed'); }
if (locked) { elements.append.disabled = elements.replace.disabled = true; }
renderAll(true);
