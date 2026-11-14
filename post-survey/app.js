import { cardNames } from '../test/cards.js';
import { study } from '../site-config.js';
import { sendResponse } from '../supabase-client.js';

const VERSION = 'portal-post-sort-survey-2026-11-14-v1';
const STORAGE_KEY = `hyu-post-sort-survey:${VERSION}`;
const SORT_KEY = 'hyu-spatial-card-sort-snap-collision-v1';
const cards = cardNames.map((name, i) => ({ id: `card-${i + 1}`, name }));
const byId = id => document.getElementById(id);
const form = byId('post-form');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cardName = id => cards.find(card => card.id === id)?.name || '';
const copy = value => JSON.parse(JSON.stringify(value));
const reasons = {
  difficult: [
    ['multiple_groups', '두 가지 이상의 그룹에 속할 수 있다고 생각해서'],
    ['unclear_function_name', '기능명만으로 실제 기능을 이해하기 어려워서'],
    ['uncertain_group', '기능은 이해했지만 적절한 그룹을 정하기 어려워서'],
    ['never_used', '해당 기능을 사용해 본 적이 없어서'], ['other', '기타'],
  ],
  naming: [
    ['unfamiliar_term', '용어가 생소하거나 전문적이어서'], ['too_broad', '이름이 너무 포괄적이어서'],
    ['similar_names', '비슷한 이름의 기능이 있어서'], ['name_function_mismatch', '이름과 실제 기능이 연결되지 않아서'], ['other', '기타'],
  ],
};
const clarityLabels = ['전혀 이해할 수 없었다', '이해하기 어려웠다', '보통이다', '이해할 수 있었다', '매우 쉽게 이해할 수 있었다'];
const criteria = [
  ['similar_purpose', '기능의 목적이나 용도가 비슷한지'], ['similar_context', '기능을 사용하는 상황이 비슷한지'],
  ['expected_portal_location', '실제 포털에서 함께 있을 것 같은지'], ['familiar_menu_structure', '평소 사용하던 포털의 메뉴 구조'], ['other', '기타'],
];
function readSort() {
  try {
    const saved = JSON.parse(localStorage.getItem(SORT_KEY) || 'null');
    const review = saved?.review;
    if (!review || !Array.isArray(review.groups) || !Array.isArray(review.singles)) return null;
    const ids = [...review.groups.flatMap(group => group.cardIds), ...review.singles];
    if (ids.length !== cards.length || new Set(ids).size !== cards.length || ids.some(id => !cards.some(card => card.id === id))) return null;
    return { source: 'canvas-snap-collision', confirmed: !!saved.confirmed, confirmed_at: saved.confirmed ? saved.confirmedAt || null : null,
      groups: review.groups.map(group => ({ id: group.id, name: group.name, card_ids: [...group.cardIds] })), ungrouped_card_ids: [...review.singles] };
  } catch { return null; }
}
const fresh = () => ({ version: VERSION, id: crypto.randomUUID(), startedAt: new Date().toISOString(), sort: readSort(), answers: { difficult: [], difficult_none: false, difficult_reasons: {}, naming: [], naming_none: false, naming_reasons: {}, clarity: null, criterion: '', criterion_other: '', consent: false }, pending: null, done: false });
let state = fresh(), submitting = false;
try {
  const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
  if (saved?.version === VERSION && saved.answers && typeof saved.id === 'string') state = saved;
} catch { /* Draft still works without browser storage. */ }
function persist() { try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {} }
function renderSource() {
  const chips = ids => `<div class="sort-chips">${ids.map(id => `<span>${esc(cardName(id))}</span>`).join('')}</div>`;
  if (!state.sort) {
    byId('sort-result').innerHTML = '<p class="source-note">저장된 분류 결과가 없습니다. 카드 목록으로 화면을 확인할 수 있습니다.</p>' + `<section class="sort-group"><h3>카드 목록</h3>${chips(cards.map(card => card.id))}</section>`;
    return;
  }
  byId('sort-result').innerHTML = (state.sort.confirmed ? '' : '<p class="source-note">이 기기에 저장된 현재 분류 결과입니다.</p>') + state.sort.groups.map(group => `<section class="sort-group"><h3>${esc(group.name)}</h3>${chips(group.card_ids)}</section>`).join('') + (state.sort.ungrouped_card_ids.length ? `<section class="sort-group"><h3>따로 둔 카드</h3>${chips(state.sort.ungrouped_card_ids)}</section>` : '');
}
for (const kind of ['difficult', 'naming']) {
  byId(`${kind}-cards`).innerHTML = cards.map(card => `<label class="choice"><input type="checkbox" data-card-kind="${kind}" value="${card.id}"><span>${esc(card.name)}</span></label>`).join('');
}
byId('clarity-options').innerHTML = clarityLabels.map((label, i) => `<label class="scale-option"><input type="radio" name="clarity" value="${i + 1}"><span class="scale-number">${i + 1}</span><span class="scale-label">${esc(label)}</span></label>`).join('');
byId('criterion-options').innerHTML = criteria.map(([value, label]) => `<label class="choice"><input type="radio" name="criterion" value="${value}"><span>${esc(label)}</span></label>`).join('');
function reasonMarkup(kind, id) {
  const answer = state.answers[`${kind}_reasons`][id] || { selected: [], other: '' };
  return `<fieldset class="reason-item" data-reason-kind="${kind}" data-card-id="${id}" data-question="${kind}-${id}" aria-labelledby="title-${kind}-${id}" aria-describedby="${kind}-${id}-error">
    <legend class="sr-only">${esc(cardName(id))}의 이유</legend>
    <h3 class="reason-title" id="title-${kind}-${id}"><span class="question-number"></span><span>${esc(cardName(id))}</span></h3>
    <div class="options">${reasons[kind].map(([value, label]) => `<label class="choice"><input type="checkbox" data-reason value="${value}" ${answer.selected.includes(value) ? 'checked' : ''}><span>${esc(label)}</span></label>`).join('')}</div>
    <div class="other-field" data-other-field hidden><label for="other-${kind}-${id}">기타 이유</label><textarea id="other-${kind}-${id}" data-other rows="3" maxlength="800" placeholder="이유를 간단히 입력해 주세요." aria-describedby="${kind}-${id}-error">${esc(answer.other)}</textarea></div>
    <p class="field-error" id="${kind}-${id}-error" hidden></p>
  </fieldset>`;
}
function syncReasonBlocks(kind) {
  const selected = state.answers[kind], list = byId(`${kind}-reasons`);
  list.querySelectorAll('[data-card-id]').forEach(el => { if (!selected.includes(el.dataset.cardId)) el.remove(); });
  selected.forEach((id, i) => {
    let block = list.querySelector(`[data-card-id="${id}"]`);
    if (!block) { list.insertAdjacentHTML('beforeend', reasonMarkup(kind, id)); block = list.querySelector(`[data-card-id="${id}"]`); }
    const next = list.children[i]; if (next !== block) list.insertBefore(block, next || null);
    block.querySelector('.question-number').textContent = `${kind === 'difficult' ? '02' : '05'}-${i + 1}`;
    const hasOther = state.answers[`${kind}_reasons`][id]?.selected.includes('other');
    block.querySelector('[data-other-field]').hidden = !hasOther;
    block.querySelector('[data-other]').disabled = !hasOther;
  });
  byId(`${kind}-reasons-section`).hidden = !selected.length;
}
function restoreFields() {
  for (const kind of ['difficult', 'naming']) {
    form.elements.namedItem(`${kind}_none`).checked = state.answers[`${kind}_none`];
    form.querySelectorAll(`[data-card-kind="${kind}"]`).forEach(el => { el.checked = state.answers[kind].includes(el.value); });
  }
  for (const name of ['clarity', 'criterion']) form.querySelectorAll(`[name="${name}"]`).forEach(el => { el.checked = el.value === String(state.answers[name] || ''); });
  byId('criterion-other').value = state.answers.criterion_other;
  form.elements.namedItem('consent').checked = state.answers.consent;
}
function readAnswers() {
  const a = copy(state.answers);
  for (const kind of ['difficult', 'naming']) {
    a[kind] = [...form.querySelectorAll(`[data-card-kind="${kind}"]:checked`)].map(el => el.value);
    a[`${kind}_none`] = form.elements.namedItem(`${kind}_none`).checked;
    form.querySelectorAll(`[data-reason-kind="${kind}"]`).forEach(block => {
      a[`${kind}_reasons`][block.dataset.cardId] = { selected: [...block.querySelectorAll('[data-reason]:checked')].map(el => el.value), other: block.querySelector('[data-other]').value };
    });
    a[kind].forEach(id => { a[`${kind}_reasons`][id] ||= { selected: [], other: '' }; });
  }
  a.clarity = Number(form.querySelector('[name="clarity"]:checked')?.value) || null;
  a.criterion = form.querySelector('[name="criterion"]:checked')?.value || '';
  a.criterion_other = byId('criterion-other').value;
  a.consent = form.elements.namedItem('consent').checked;
  return a;
}
function clearError(key) {
  const section = form.querySelector(`[data-question="${key}"]`);
  section?.removeAttribute('data-invalid'); section?.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
  const error = byId(`${key}-error`); if (error) { error.hidden = true; error.textContent = ''; }
  if (!form.querySelector('[data-invalid]')) byId('validation-summary').hidden = true;
}
function validate() {
  const a = state.answers, errors = [];
  for (const kind of ['difficult', 'naming']) {
    if (!a[kind].length && !a[`${kind}_none`]) errors.push([kind, kind === 'difficult' ? '카드를 선택하거나 ‘어려웠던 기능 없음’을 선택해 주세요.' : '카드를 선택하거나 ‘해당 없음’을 선택해 주세요.']);
    if (kind === 'difficult' && a[kind].length > 3) errors.push([kind, '분류하기 어려웠던 카드는 최대 3개까지 선택해 주세요.']);
    for (const id of a[kind]) {
      const answer = a[`${kind}_reasons`][id];
      if (!answer.selected.length) errors.push([`${kind}-${id}`, '이 카드의 이유를 하나 이상 선택해 주세요.']);
      else if (answer.selected.includes('other') && !answer.other.trim()) errors.push([`${kind}-${id}`, '이 카드의 기타 이유를 입력해 주세요.']);
    }
  }
  if (![1, 2, 3, 4, 5].includes(a.clarity)) errors.push(['clarity', '명칭으로 기능을 이해할 수 있었던 정도를 선택해 주세요.']);
  if (!criteria.some(([value]) => value === a.criterion)) errors.push(['criterion', '가장 중요하게 생각한 분류 기준을 선택해 주세요.']);
  else if (a.criterion === 'other' && !a.criterion_other.trim()) errors.push(['criterion', '기타 기준을 입력해 주세요.']);
  if (!a.consent) errors.push(['consent', '응답 제출에 동의해 주세요.']);
  return errors;
}
function showErrors(errors) {
  form.querySelectorAll('[data-question]').forEach(el => clearError(el.dataset.question));
  for (const [key, message] of errors) {
    const section = form.querySelector(`[data-question="${key}"]`);
    section.dataset.invalid = 'true'; section.querySelectorAll('input:not(:disabled),textarea:not(:disabled)').forEach(el => el.setAttribute('aria-invalid', 'true'));
    const error = byId(`${key}-error`); error.textContent = message; error.hidden = false;
  }
  byId('validation-summary').textContent = '표시된 문항을 확인한 뒤 제출해 주세요.'; byId('validation-summary').hidden = !errors.length;
  if (errors.length) {
    const first = form.querySelector(`[data-question="${errors[0][0]}"]`);
    first.querySelector('input:not(:disabled),textarea:not(:disabled)')?.focus({ preventScroll: true }); first.scrollIntoView({ block: 'center', behavior: 'instant' });
  }
}
function syncUI() {
  byId('response-fields').disabled = submitting || !!state.pending;
  for (const kind of ['difficult', 'naming']) {
    syncReasonBlocks(kind);
    form.querySelectorAll(`[data-card-kind="${kind}"]`).forEach(el => { el.checked = state.answers[kind].includes(el.value); el.disabled = kind === 'difficult' && state.answers.difficult.length >= 3 && !el.checked; });
  }
  byId('criterion-other-field').hidden = state.answers.criterion !== 'other';
  byId('criterion-other').disabled = state.answers.criterion !== 'other';
  byId('pending-note').hidden = !state.pending || submitting;
  byId('submit-button').disabled = submitting;
  byId('submit-button').textContent = submitting ? '저장 중…' : state.pending ? '다시 제출' : '응답 제출';
  form.hidden = state.done; byId('complete-panel').hidden = !state.done;
  if (!form.querySelector('[data-invalid]')) byId('validation-summary').hidden = true;
}
form.addEventListener('input', event => {
  if (state.pending || state.done || submitting) return;
  const kind = event.target.dataset.cardKind || (event.target.name === 'difficult_none' ? 'difficult' : event.target.name === 'naming_none' ? 'naming' : null);
  if (kind && event.target.checked) {
    if (event.target.name === `${kind}_none`) form.querySelectorAll(`[data-card-kind="${kind}"]`).forEach(el => { el.checked = false; });
    else form.elements.namedItem(`${kind}_none`).checked = false;
  }
  state.answers = readAnswers(); clearError(event.target.closest('[data-question]')?.dataset.question); persist(); syncUI();
});
function buildRecord() {
  const a = state.answers;
  const cardAnswers = kind => a[kind].map(id => ({ card_id: id, reasons: [...a[`${kind}_reasons`][id].selected], other: a[`${kind}_reasons`][id].selected.includes('other') ? a[`${kind}_reasons`][id].other.trim() : null }));
  return { id: state.id, study_version: VERSION, is_test: true, payload: {
    schema_version: 1, kind: 'portal_post_sort_survey', study_mode: 'pilot', consent: a.consent,
    cards: copy(cards), sort_result: copy(state.sort),
    answers: { difficult_none: a.difficult_none, difficult_cards: cardAnswers('difficult'), label_comprehension: a.clarity, naming_none: a.naming_none, naming_difficult_cards: cardAnswers('naming'), grouping_criterion: a.criterion, grouping_criterion_other: a.criterion === 'other' ? a.criterion_other.trim() : null },
    questionnaire: { sorting_reasons: Object.fromEntries(reasons.difficult), naming_reasons: Object.fromEntries(reasons.naming), label_comprehension_scale: Object.fromEntries(clarityLabels.map((label, i) => [i + 1, label])), grouping_criteria: Object.fromEntries(criteria) },
    started_at: state.startedAt, submitted_at_client: new Date().toISOString(),
  } };
}
form.addEventListener('submit', async event => {
  event.preventDefault(); if (submitting || state.done) return;
  if (!state.pending) { state.answers = readAnswers(); const errors = validate(); if (errors.length) { showErrors(errors); return; } state.pending = buildRecord(); persist(); }
  submitting = true; byId('submit-error').hidden = true; byId('validation-summary').hidden = true; syncUI();
  try {
    await sendResponse(study, state.pending); state.done = true; state.pending = null; persist(); syncUI(); byId('complete-title').focus(); byId('complete-panel').scrollIntoView({ block: 'center', behavior: 'instant' }); byId('announcer').textContent = '응답이 저장되었습니다.';
  } catch { byId('submit-error').textContent = '저장 완료를 확인하지 못했습니다. 연결 상태를 확인한 뒤 다시 제출해 주세요. 작성한 응답은 유지됩니다.'; byId('submit-error').hidden = false; }
  finally { submitting = false; syncUI(); }
});
renderSource(); restoreFields(); syncUI(); persist();
