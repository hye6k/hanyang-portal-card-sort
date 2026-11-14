import { integrated, urls, updateFlow } from '../study/flow.js?v=journey-2';
import { cardNames } from '../test/cards.js';
import { study } from '../site-config.js';
import { sendResponse } from '../supabase-client.js';

const VERSION = 'portal-post-sort-survey-2026-11-14-v2';
const STORAGE_KEY = `hyu-post-sort-survey:${VERSION}${integrated ? ':study' : ''}`;
const LEGACY_KEY = 'hyu-post-sort-survey:portal-post-sort-survey-2026-11-14-v1';
const SORT_KEY = 'hyu-spatial-card-sort-snap-collision-v1';
const cards = cardNames.map((name, i) => ({ id: `card-${i + 1}`, name }));
const byId = id => document.getElementById(id), form = byId('post-form');
const copy = value => JSON.parse(JSON.stringify(value));
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cardName = id => cards.find(card => card.id === id)?.name || '';
const reasons = {
  difficult: [['multiple_groups', '두 가지 이상의 그룹에 속할 수 있다고 생각해서'], ['unclear_function_name', '기능명만으로 실제 기능을 이해하기 어려워서'], ['uncertain_group', '기능은 이해했지만 적절한 그룹을 정하기 어려워서'], ['never_used', '해당 기능을 사용해 본 적이 없어서'], ['other', '기타']],
  naming: [['unfamiliar_term', '용어가 생소하거나 전문적이어서'], ['too_broad', '이름이 너무 포괄적이어서'], ['similar_names', '비슷한 이름의 기능이 있어서'], ['name_function_mismatch', '이름과 실제 기능이 연결되지 않아서'], ['other', '기타']],
};
const clarityLabels = ['전혀 이해할 수 없었다', '이해하기 어려웠다', '보통이다', '이해할 수 있었다', '매우 쉽게 이해할 수 있었다'];
const criteria = [['similar_purpose', '기능의 목적이나 용도가 비슷한지'], ['similar_context', '기능을 사용하는 상황이 비슷한지'], ['expected_portal_location', '실제 포털에서 함께 있을 것 같은지'], ['familiar_menu_structure', '평소 사용하던 포털의 메뉴 구조'], ['other', '기타']];
function readSort() {
  try {
    const saved = JSON.parse(localStorage.getItem(SORT_KEY) || 'null'), review = saved?.review;
    if (!review || !Array.isArray(review.groups) || !Array.isArray(review.singles)) return null;
    const ids = [...review.groups.flatMap(group => group.cardIds), ...review.singles];
    if (ids.length !== cards.length || new Set(ids).size !== cards.length || ids.some(id => !cards.some(card => card.id === id))) return null;
    return { source: 'canvas-snap-collision', confirmed: !!saved.confirmed, confirmed_at: saved.confirmed ? saved.confirmedAt || null : null,
      groups: review.groups.map(group => ({ id: group.id, name: group.name, card_ids: [...group.cardIds] })), ungrouped_card_ids: [...review.singles], description_views: copy(saved.descriptionViews || {}) };
  } catch { return null; }
}
const emptyAnswers = () => ({ difficult: [], difficult_none: false, difficult_reasons: {}, naming: [], naming_none: false, naming_reasons: {}, clarity: null, criterion: [], criterion_other: '', consent: false });
const fresh = () => ({ version: VERSION, id: crypto.randomUUID(), startedAt: new Date().toISOString(), sort: readSort(), answers: emptyAnswers(), stage: 'select', scroll: {}, pending: null, done: false });
let state = fresh(), submitting = false;
try {
  const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
  if (saved?.version === VERSION && saved.answers && typeof saved.id === 'string') state = saved;
  else {
    const legacy = JSON.parse(sessionStorage.getItem(LEGACY_KEY) || 'null');
    if (!integrated && legacy?.answers && !legacy.done && typeof legacy.id === 'string') state = { ...legacy, version: VERSION, stage: legacy.pending ? 'questions' : 'select', scroll: {} };
  }
} catch { /* Keep the draft in memory if session storage is unavailable. */ }
state.answers = { ...emptyAnswers(), ...state.answers }; state.scroll ||= {};
if (!Array.isArray(state.answers.criterion)) state.answers.criterion = state.answers.criterion ? [state.answers.criterion] : [];
for (const kind of ['difficult', 'naming']) {
  state.answers[kind] = state.answers[kind].filter(id => cards.some(card => card.id === id));
  state.answers[kind].forEach(id => { state.answers[`${kind}_reasons`][id] ||= { selected: [], other: '' }; });
}
if (!state.pending && !state.done) state.sort = readSort();
const requestedStage = new URLSearchParams(location.search).get('stage');
if (requestedStage === 'select' || requestedStage === 'questions') state.stage = requestedStage;
if (state.pending) state.stage = 'questions';
if (!['select', 'questions'].includes(state.stage)) state.stage = 'select';
try { history.scrollRestoration = 'manual'; } catch {}
function persist() { try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {} }
function groupNameFor(id) { return state.sort?.groups.find(group => group.card_ids.includes(id))?.name || '따로 둔 카드'; }
function renderSelection() {
  if (!state.sort) {
    byId('sort-selection').innerHTML = '<div class="source-empty">저장된 분류 결과가 없습니다.<br><button type="button" class="flow-text-button" data-start-sort>카드 분류 시작</button></div>';
    return;
  }
  const groups = state.sort.groups.map(group => ({ name: group.name, ids: group.card_ids }));
  if (state.sort.ungrouped_card_ids.length) groups.push({ ungrouped: true, name: '따로 둔 카드', ids: state.sort.ungrouped_card_ids });
  byId('sort-selection').innerHTML = groups.map(group => `<section class="selection-group${group.ungrouped ? ' selection-ungrouped' : ''}"><div class="selection-columns"><h3>${esc(group.name)}</h3><span aria-hidden="true">분류가<br>애매함</span><span aria-hidden="true">명칭이<br>어려움</span></div><div class="selection-grid">${group.ids.map(id => `<article class="selection-card" data-menu="${id}"><p>${esc(cardName(id))}</p><label class="selection-check"><input type="checkbox" data-card-kind="difficult" value="${id}" aria-label="${esc(cardName(id))}: 분류가 애매함"></label><label class="selection-check"><input type="checkbox" data-card-kind="naming" value="${id}" aria-label="${esc(cardName(id))}: 명칭이 어려움"></label></article>`).join('')}</div></section>`).join('');
}
byId('clarity-options').innerHTML = clarityLabels.map((label, i) => `<label class="scale-option"><input type="radio" name="clarity" value="${i + 1}"><span class="scale-number">${i + 1}</span><span class="scale-label">${esc(label)}</span></label>`).join('');
byId('criterion-options').innerHTML = criteria.map(([value, label]) => `<label class="choice"><input type="checkbox" name="criterion" value="${value}"><span>${esc(label)}</span></label>`).join('');
function reasonMarkup(kind, id) {
  const answer = state.answers[`${kind}_reasons`][id] || { selected: [], other: '' };
  return `<fieldset class="flow-reason" data-reason-kind="${kind}" data-card-id="${id}" data-question="${kind}-${id}" aria-labelledby="title-${kind}-${id}" aria-describedby="${kind}-${id}-error"><legend class="sr-only">${esc(cardName(id))}의 이유</legend><h4 id="title-${kind}-${id}">${kind === 'difficult' ? '분류하기 애매했던 이유는 무엇인가요?' : '명칭을 이해하기 어려웠던 이유는 무엇인가요?'}</h4><div class="options">${reasons[kind].map(([value, label]) => `<label class="choice"><input type="checkbox" data-reason value="${value}" ${answer.selected.includes(value) ? 'checked' : ''}><span>${esc(label)}</span></label>`).join('')}</div><div class="other-field" data-other-field hidden><label for="other-${kind}-${id}">기타 이유</label><textarea id="other-${kind}-${id}" data-other rows="3" maxlength="800" placeholder="이유를 간단히 입력해 주세요." aria-describedby="${kind}-${id}-error">${esc(answer.other)}</textarea></div><p class="field-error" id="${kind}-${id}-error" hidden></p></fieldset>`;
}
function syncReasonBlocks() {
  const list = byId('menu-reasons'), selected = [...new Set([...state.answers.difficult, ...state.answers.naming])];
  list.querySelectorAll('[data-followup-menu]').forEach(el => { if (!selected.includes(el.dataset.followupMenu)) el.remove(); });
  selected.forEach((id, i) => {
    let article = list.querySelector(`[data-followup-menu="${id}"]`);
    if (!article) { list.insertAdjacentHTML('beforeend', `<article class="menu-followup" data-followup-menu="${id}"><div class="menu-followup-heading"><h3>${esc(cardName(id))}</h3><span data-current-group></span></div><div data-menu-questions></div></article>`); article = list.querySelector(`[data-followup-menu="${id}"]`); }
    const next = list.children[i]; if (next !== article) list.insertBefore(article, next || null);
    article.querySelector('[data-current-group]').textContent = groupNameFor(id);
    const questions = article.querySelector('[data-menu-questions]');
    for (const kind of ['difficult', 'naming']) {
      let block = questions.querySelector(`[data-reason-kind="${kind}"]`);
      if (!state.answers[kind].includes(id)) { block?.remove(); continue; }
      if (!block) { questions.insertAdjacentHTML('beforeend', reasonMarkup(kind, id)); block = questions.querySelector(`[data-reason-kind="${kind}"]`); }
      const hasOther = state.answers[`${kind}_reasons`][id]?.selected.includes('other');
      block.querySelector('[data-other-field]').hidden = !hasOther; block.querySelector('[data-other]').disabled = !hasOther;
    }
  });
  byId('menu-reasons-section').hidden = !selected.length;
}
function restoreFields() {
  for (const name of ['clarity']) form.querySelectorAll(`[name="${name}"]`).forEach(el => { el.checked = el.value === String(state.answers[name] || ''); });
  form.querySelectorAll('[name=criterion]').forEach(el => { el.checked = state.answers.criterion.includes(el.value); });
  byId('criterion-other').value = state.answers.criterion_other; form.elements.namedItem('consent').checked = state.answers.consent;
}
function readAnswers() {
  const a = copy(state.answers);
  for (const kind of ['difficult', 'naming']) {
    if (state.sort) a[kind] = [...form.querySelectorAll(`[data-card-kind="${kind}"]:checked`)].map(el => el.value);
    a[`${kind}_none`] = a[kind].length === 0;
    form.querySelectorAll(`[data-reason-kind="${kind}"]`).forEach(block => { a[`${kind}_reasons`][block.dataset.cardId] = { selected: [...block.querySelectorAll('[data-reason]:checked')].map(el => el.value), other: block.querySelector('[data-other]').value }; });
    a[kind].forEach(id => { a[`${kind}_reasons`][id] ||= { selected: [], other: '' }; });
  }
  a.clarity = Number(form.querySelector('[name="clarity"]:checked')?.value) || null; a.criterion = [...form.querySelectorAll('[name="criterion"]:checked')].map(el => el.value); a.criterion_other = byId('criterion-other').value; a.consent = form.elements.namedItem('consent').checked;
  return a;
}
function questionErrors() {
  const errors = [], a = state.answers;
  for (const kind of ['difficult', 'naming']) for (const id of a[kind]) {
    const answer = a[`${kind}_reasons`][id];
    if (!answer.selected.length) errors.push([`${kind}-${id}`, '이 메뉴의 이유를 하나 이상 선택해 주세요.']);
    else if (answer.selected.includes('other') && !answer.other.trim()) errors.push([`${kind}-${id}`, '이 메뉴의 기타 이유를 입력해 주세요.']);
  }
  if (![1, 2, 3, 4, 5].includes(a.clarity)) errors.push(['clarity', '명칭으로 기능을 이해할 수 있었던 정도를 선택해 주세요.']);
  if (!a.criterion.length || a.criterion.some(item => !criteria.some(([value]) => value === item))) errors.push(['criterion', '고려한 분류 기준을 하나 이상 선택해 주세요.']);
  else if (a.criterion.includes('other') && !a.criterion_other.trim()) errors.push(['criterion', '기타 기준을 입력해 주세요.']);
  if (!a.consent) errors.push(['consent', '응답 제출에 동의해 주세요.']);
  return errors;
}
function clearError(key) {
  const section = form.querySelector(`[data-question="${key}"]`); section?.removeAttribute('data-invalid'); section?.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
  const error = byId(`${key}-error`); if (error) { error.hidden = true; error.textContent = ''; }
  if (!form.querySelector('[data-invalid]')) byId('validation-summary').hidden = true;
}
function showErrors(errors) {
  form.querySelectorAll('[data-question]').forEach(el => clearError(el.dataset.question));
  for (const [key, message] of errors) { const section = form.querySelector(`[data-question="${key}"]`); section.dataset.invalid = 'true'; section.querySelectorAll('input:not(:disabled),textarea:not(:disabled)').forEach(el => el.setAttribute('aria-invalid', 'true')); const error = byId(`${key}-error`); error.textContent = message; error.hidden = false; }
  byId('validation-summary').textContent = '표시된 항목을 확인한 뒤 진행해 주세요.'; byId('validation-summary').hidden = !errors.length;
  if (errors.length) { const first = form.querySelector(`[data-question="${errors[0][0]}"]`); first.querySelector('input:not(:disabled),textarea:not(:disabled)')?.focus({ preventScroll: true }); first.scrollIntoView({ block: 'center', behavior: 'instant' }); }
}
function syncUI() {
  const frozen = submitting || !!state.pending, questions = state.stage === 'questions';
  updateFlow(questions ? 'post-2' : 'post-1', frozen || state.done);
  byId('response-fields').disabled = frozen;
  syncReasonBlocks();
  for (const kind of ['difficult', 'naming']) form.querySelectorAll(`[data-card-kind="${kind}"]`).forEach(el => { el.checked = state.answers[kind].includes(el.value); el.disabled = false; });
  byId('selection-panel').hidden = questions; byId('questions-panel').hidden = !questions;
  byId('back-selection').hidden = !questions && !integrated; byId('back-selection').disabled = frozen; byId('back-selection').textContent = integrated ? '이전' : '← 선택 수정';
  byId('next-questions').hidden = questions; byId('next-questions').disabled = !state.sort || frozen;
  byId('submit-button').hidden = !questions; byId('submit-button').disabled = submitting;
  byId('submit-button').textContent = submitting ? '저장 중…' : state.pending ? '다시 제출' : '최종 제출';
  byId('edit-groups').disabled = frozen; byId('edit-groups').textContent = state.sort ? '← 그룹 수정' : '← 카드 분류 시작';
  byId('criterion-other-field').hidden = !state.answers.criterion.includes('other'); byId('criterion-other').disabled = !state.answers.criterion.includes('other');
  byId('pending-note').hidden = !state.pending || submitting;
  byId('page-title').textContent = state.done ? '제출 완료' : questions ? '어려웠던 이유와 분류 기준' : '분류하면서 어려웠던 메뉴'; document.title = byId('page-title').textContent;
  document.querySelectorAll('[data-step]').forEach(el => { if (el.dataset.step === state.stage) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current'); });
  form.hidden = state.done; byId('complete-panel').hidden = !state.done; byId('edit-groups').hidden = state.done;
  if (!form.querySelector('[data-invalid]')) byId('validation-summary').hidden = true;
}
function saveCurrent() { if (!state.pending && !state.done) state.answers = readAnswers(); state.scroll[state.stage] = scrollY; persist(); }
function stageUrl(stage) { const url = new URL(location.href); url.searchParams.set('stage', stage); url.searchParams.set('v', 'flow-7'); url.searchParams.delete('from'); if (integrated) url.searchParams.set('step',stage === 'questions' ? 'post-2' : 'post-1'); return url.pathname + url.search; }
function showStage(stage, push = true) {
  saveCurrent(); state.stage = stage; persist();
  if (push) history.pushState({ stage }, '', stageUrl(stage));
  form.querySelectorAll('[data-question]').forEach(el => clearError(el.dataset.question)); byId('submit-error').hidden = true; syncUI();
  requestAnimationFrame(() => { window.scrollTo({ top: state.scroll[stage] || 0, behavior: 'instant' }); byId('page-title').focus({ preventScroll: true }); });
}
function editGroups() { if (state.pending || state.done || submitting) return; saveCurrent(); location.assign(integrated ? urls.cards : '../canvas-snap-collision/?resume=post-survey&v=snap-collision-12'); }
byId('edit-groups').addEventListener('click', editGroups);
byId('sort-selection').addEventListener('click', event => { if (event.target.closest('[data-start-sort]')) editGroups(); });
byId('back-selection').addEventListener('click', () => { if (!state.pending && !submitting) { if (integrated && state.stage === 'select') editGroups(); else showStage('select'); } });
byId('next-questions').addEventListener('click', () => { if (state.pending || submitting || !state.sort) return; state.answers = readAnswers(); showStage('questions'); });
form.addEventListener('input', event => {
  if (state.pending || state.done || submitting) return;
  const kind = event.target.dataset.cardKind;
  state.answers = readAnswers(); clearError(kind || event.target.closest('[data-question]')?.dataset.question); persist(); syncUI();
});
function buildRecord() {
  const a = state.answers, answersFor = kind => a[kind].map(id => ({ card_id: id, reasons: [...a[`${kind}_reasons`][id].selected], other: a[`${kind}_reasons`][id].selected.includes('other') ? a[`${kind}_reasons`][id].other.trim() : null }));
  return { id: state.id, study_version: VERSION, is_test: true, payload: { schema_version: 3, kind: 'portal_post_sort_survey', study_mode: 'pilot', workflow: integrated ? 'pre-sort-post-v1' : 'sort-select-questions-v1', ...(integrated ? { pre_survey: JSON.parse(sessionStorage.getItem('hyu-study-pre') || 'null') } : {}), consent: a.consent, cards: copy(cards), sort_result: copy(state.sort), answers: { difficult_none: a.difficult_none, difficult_cards: answersFor('difficult'), label_comprehension: a.clarity, naming_none: a.naming_none, naming_difficult_cards: answersFor('naming'), grouping_criteria: [...a.criterion], grouping_criterion_other: a.criterion.includes('other') ? a.criterion_other.trim() : null }, questionnaire: { sorting_reasons: Object.fromEntries(reasons.difficult), naming_reasons: Object.fromEntries(reasons.naming), label_comprehension_scale: Object.fromEntries(clarityLabels.map((label, i) => [i + 1, label])), grouping_criteria: Object.fromEntries(criteria) }, started_at: state.startedAt, submitted_at_client: new Date().toISOString() } };
}
form.addEventListener('submit', async event => {
  event.preventDefault(); if (submitting || state.done) return;
  if (!state.pending) {
    if (integrated && !sessionStorage.getItem('hyu-study-pre')) { location.assign(urls.pre); return; }
    state.answers = readAnswers();
    if (state.stage !== 'questions' || !state.sort) { showStage('select'); return; }
    const errors = questionErrors(); if (errors.length) { showErrors(errors); return; }
    state.sort = readSort(); if (!state.sort) { renderSelection(); showStage('select'); return; }
    state.pending = buildRecord(); persist();
  }
  submitting = true; byId('submit-error').hidden = true; byId('validation-summary').hidden = true; syncUI();
  try { await sendResponse(study, state.pending); state.done = true; state.pending = null; persist(); syncUI(); byId('complete-title').focus(); byId('complete-panel').scrollIntoView({ block: 'center', behavior: 'instant' }); byId('announcer').textContent = '응답이 저장되었습니다.'; }
  catch { byId('submit-error').textContent = '저장 완료를 확인하지 못했습니다. 연결 상태를 확인한 뒤 다시 제출해 주세요. 작성한 응답은 유지됩니다.'; byId('submit-error').hidden = false; }
  finally { submitting = false; syncUI(); }
});
window.addEventListener('popstate', () => { saveCurrent(); let stage = new URLSearchParams(location.search).get('stage') === 'questions' ? 'questions' : 'select'; if (state.pending || state.done) stage = 'questions'; if (!state.pending && !state.done && !state.sort) stage = 'select'; showStage(stage, false); });
window.addEventListener('pagehide', saveCurrent);
window.addEventListener('pageshow', event => { if (!event.persisted || state.pending || state.done) return; state.sort = readSort(); renderSelection(); restoreFields(); state.stage = 'select'; syncUI(); persist(); history.replaceState({ stage: state.stage }, '', stageUrl(state.stage)); requestAnimationFrame(() => window.scrollTo({ top: state.scroll.select || 0, behavior: 'instant' })); });
renderSelection(); restoreFields();
if (!state.pending && !state.done && !state.sort) state.stage = 'select';
syncUI(); persist(); history.replaceState({ stage: state.stage }, '', stageUrl(state.stage));
requestAnimationFrame(() => window.scrollTo({ top: state.scroll[state.stage] || 0, behavior: 'instant' }));
