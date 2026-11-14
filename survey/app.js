import { study } from '../site-config.js';
import { sendResponse } from '../supabase-client.js';

const VERSION = 'portal-experience-survey-2026-11-14-v2';
const STORAGE_KEY = `hyu-portal-survey:${VERSION}`;
const LEGACY_KEY = 'hyu-portal-survey:portal-experience-survey-2026-11-14-v1';
const IS_TEST = true;
const frequencyOptions = [
  ['daily', '거의 매일'], ['weekly_2_3', '주 2~3회'], ['weekly_1', '주 1회'],
  ['monthly_1_3', '월 1~3회'], ['rarely', '거의 사용하지 않음'],
];
const difficultyOptions = ['전혀 없음', '드물게 있음', '가끔 있음', '자주 있음', '매우 자주 있음'];
const easeOptions = ['전혀 그렇지 않다', '그렇지 않다', '보통이다', '그렇다', '매우 그렇다'];
const reasonOptions = [
  ['ambiguous_name', '명칭이 모호함'], ['unexpected_location', '메뉴 위치를 예상하기 어려움'],
  ['similar_menus', '비슷한 메뉴가 많음'], ['too_many_steps', '탐색 단계가 많음'],
  ['unaware_function', '기능 자체를 몰랐음'], ['other', '기타'],
];
const form = document.querySelector('#survey-form');
const fields = document.querySelector('#response-fields');
const button = document.querySelector('#submit-button');
const byId = id => document.getElementById(id);
const named = name => form.elements.namedItem(name);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const newFunction = () => ({ id: crypto.randomUUID(), name: '', cannot_recall: false, reasons: [], other_reason: '' });
const fresh = () => ({ version: VERSION, id: crypto.randomUUID(), startedAt: new Date().toISOString(), answers: { functions: [newFunction()] }, pending: null, done: false });
let state = fresh();
let submitting = false;
try {
  const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
  if (saved?.version === VERSION && saved.answers && typeof saved.id === 'string') state = saved;
  else {
    const legacy = JSON.parse(sessionStorage.getItem(LEGACY_KEY) || 'null');
    if (legacy?.answers && !legacy.done && typeof legacy.id === 'string') {
      const a = legacy.answers;
      state = { ...legacy, version: VERSION, answers: { ...a, functions: [{ ...newFunction(), name: a.hardest_function || '', cannot_recall: !!a.cannot_recall, reasons: a.reasons || [], other_reason: a.other_reason || '' }] } };
      // A frozen legacy request must retain its original UUID and body on retry.
    }
  }
} catch { /* Keep the draft in memory if session storage is unavailable. */ }
const seenIds = new Set();
state.answers.functions = (Array.isArray(state.answers.functions) && state.answers.functions.length ? state.answers.functions : [newFunction()]).map(item => {
  const id = typeof item.id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(item.id) && !seenIds.has(item.id) ? item.id : crypto.randomUUID();
  seenIds.add(id);
  return { id, name: typeof item.name === 'string' ? item.name : '', cannot_recall: !!item.cannot_recall, reasons: Array.isArray(item.reasons) ? item.reasons.filter(code => reasonOptions.some(([value]) => value === code)) : [], other_reason: typeof item.other_reason === 'string' ? item.other_reason : '' };
});
function persist() {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { /* Keep the draft in memory if session storage is unavailable. */ }
}
function radioOptions(name, list, scale = false) {
  return list.map(([value, label]) => `<label class="${scale ? 'scale-option' : 'choice'}"><input type="radio" name="${name}" value="${value}" required>${scale ? `<span class="scale-number">${value}</span><span class="scale-label">${esc(label)}</span>` : `<span>${esc(label)}</span>`}</label>`).join('');
}
byId('frequency-options').innerHTML = radioOptions('frequency', frequencyOptions);
byId('difficulty-options').innerHTML = radioOptions('difficulty', difficultyOptions.map((label, i) => [i + 1, label]), true);
byId('ease-options').innerHTML = radioOptions('ease', easeOptions.map((label, i) => [i + 1, label]), true);

const functionLabel = (item, index) => item.cannot_recall ? `기억나지 않는 기능 ${index + 1}` : item.name.trim() || `기능 ${index + 1}`;
function renderFunctions() {
  const list = state.answers.functions;
  byId('function-list').innerHTML = list.map((item, i) => `<div class="function-entry" data-function-row="${item.id}" data-question="function-${item.id}">
    <div class="function-row-heading"><label for="function-name-${item.id}">기능 ${i + 1}</label>${list.length > 1 ? `<button type="button" class="remove-function" data-action="remove-function" data-function-id="${item.id}" aria-label="${i + 1}번째 기능 삭제">×</button>` : ''}</div>
    <input id="function-name-${item.id}" data-function-name type="text" value="${esc(item.name)}" maxlength="200" placeholder="기능명을 입력해 주세요." aria-describedby="function-${item.id}-error">
    <label class="check-option recall-option"><input type="checkbox" data-cannot-recall ${item.cannot_recall ? 'checked' : ''}><span>기억나지 않음</span></label>
    <p class="field-error" id="function-${item.id}-error" hidden></p>
  </div>`).join('');
  byId('reason-list').innerHTML = list.map((item, i) => `<fieldset class="reason-item" data-reason-for="${item.id}" data-question="reason-${item.id}" aria-labelledby="reason-title-${item.id}" aria-describedby="reason-${item.id}-error">
    <legend class="sr-only">${i + 1}번째 기능의 불편한 점</legend>
    <h3 class="reason-title" id="reason-title-${item.id}"><span class="question-number">05-${i + 1}</span><span data-function-heading>${esc(functionLabel(item, i))}</span></h3>
    <div class="options">${reasonOptions.map(([value, label]) => `<label class="choice"><input type="checkbox" data-reason value="${value}" ${item.reasons.includes(value) ? 'checked' : ''}><span>${esc(label)}</span></label>`).join('')}</div>
    <div class="other-field" data-other-field ${item.reasons.includes('other') ? '' : 'hidden'}><label for="other-reason-${item.id}">기타 이유</label><textarea id="other-reason-${item.id}" data-other-reason rows="3" maxlength="800" placeholder="이유를 간단히 입력해 주세요." aria-describedby="reason-${item.id}-error">${esc(item.other_reason)}</textarea></div>
    <p class="field-error" id="reason-${item.id}-error" hidden></p>
  </fieldset>`).join('');
}
function restoreFields() {
  const a = state.answers;
  for (const name of ['student_number', 'department', 'participant_name']) named(name).value = typeof a[name] === 'string' ? a[name] : '';
  for (const name of ['frequency', 'difficulty', 'ease']) for (const el of form.querySelectorAll(`[name="${name}"]`)) el.checked = el.value === String(a[name] || '');
  named('consent').checked = !!a.consent;
  renderFunctions();
}
function readFields() {
  const chosen = name => form.querySelector(`[name="${name}"]:checked`)?.value || '';
  return {
    student_number: named('student_number').value, department: named('department').value,
    participant_name: named('participant_name').value, frequency: chosen('frequency'),
    difficulty: Number(chosen('difficulty')) || null, ease: Number(chosen('ease')) || null,
    consent: named('consent').checked,
    functions: state.answers.functions.map(item => {
      const row = byId(`function-name-${item.id}`).closest('[data-function-row]');
      const reason = form.querySelector(`[data-reason-for="${item.id}"]`);
      return { id: item.id, name: row.querySelector('[data-function-name]').value,
        cannot_recall: row.querySelector('[data-cannot-recall]').checked,
        reasons: [...reason.querySelectorAll('[data-reason]:checked')].map(el => el.value),
        other_reason: reason.querySelector('[data-other-reason]').value };
    }),
  };
}
function errorsFor(a) {
  const errors = [];
  if (![a.student_number, a.department, a.participant_name].every(v => v?.trim())) errors.push(['participant', '학번, 학과, 이름을 모두 입력해 주세요.']);
  if (!frequencyOptions.some(([value]) => value === a.frequency)) errors.push(['frequency', '이용 빈도를 선택해 주세요.']);
  if (![1, 2, 3, 4, 5].includes(a.difficulty)) errors.push(['difficulty', '어려움을 겪은 빈도를 선택해 주세요.']);
  if (a.difficulty !== 1) for (const [i, item] of a.functions.entries()) {
    if (!item.cannot_recall && !item.name.trim()) errors.push([`function-${item.id}`, `기능 ${i + 1}의 이름을 입력하거나 ‘기억나지 않음’을 선택해 주세요.`]);
    if (!item.reasons.length) errors.push([`reason-${item.id}`, '이 기능을 찾기 어려웠던 이유를 하나 이상 선택해 주세요.']);
    else if (item.reasons.includes('other') && !item.other_reason.trim()) errors.push([`reason-${item.id}`, '이 기능의 기타 이유를 입력해 주세요.']);
  }
  if (![1, 2, 3, 4, 5].includes(a.ease)) errors.push(['ease', '원하는 기능을 쉽게 찾을 수 있는지 선택해 주세요.']);
  if (!a.consent) errors.push(['consent', '정보 수집과 응답 제출에 동의해 주세요.']);
  return errors;
}
function clearError(key) {
  const section = form.querySelector(`[data-question="${key}"]`);
  section?.removeAttribute('data-invalid');
  section?.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
  const el = byId(`${key}-error`);
  if (el) { el.textContent = ''; el.hidden = true; }
  if (!form.querySelector('[data-invalid]')) byId('validation-summary').hidden = true;
}
function showErrors(errors) {
  form.querySelectorAll('[data-question]').forEach(el => clearError(el.dataset.question));
  for (const [key, message] of errors) {
    const section = form.querySelector(`[data-question="${key}"]`);
    section.dataset.invalid = 'true';
    section.querySelectorAll('input:not(:disabled),textarea:not(:disabled)').forEach(el => el.setAttribute('aria-invalid', 'true'));
    byId(`${key}-error`).textContent = message; byId(`${key}-error`).hidden = false;
  }
  byId('validation-summary').textContent = '표시된 문항을 확인한 뒤 제출해 주세요.';
  byId('validation-summary').hidden = !errors.length;
  if (errors.length) {
    const first = form.querySelector(`[data-question="${errors[0][0]}"]`);
    first.querySelector('input:not(:disabled),textarea:not(:disabled)')?.focus({ preventScroll: true });
    first.scrollIntoView({ block: 'center', behavior: 'instant' });
  }
}
function syncUI() {
  const a = state.answers, noDifficulty = a.difficulty === 1;
  fields.disabled = submitting || !!state.pending;
  for (const key of ['hardest', 'reasons']) {
    const section = form.querySelector(`[data-question="${key}"]`);
    section.dataset.skipped = String(noDifficulty);
    byId(`${key}-skipped`).hidden = !noDifficulty;
    byId(`${key}-fields`).hidden = noDifficulty;
    byId(`${key}-fields`).disabled = noDifficulty;
    if (noDifficulty) clearError(key);
  }
  for (const [i, item] of a.functions.entries()) {
    const input = byId(`function-name-${item.id}`), reason = form.querySelector(`[data-reason-for="${item.id}"]`);
    input.disabled = noDifficulty || item.cannot_recall;
    reason.querySelector('[data-function-heading]').textContent = functionLabel(item, i);
    reason.querySelector('[data-other-field]').hidden = !item.reasons.includes('other');
    reason.querySelector('[data-other-reason]').disabled = noDifficulty || !item.reasons.includes('other');
  }
  byId('pending-note').hidden = !state.pending || submitting;
  button.disabled = submitting;
  button.textContent = submitting ? '저장 중…' : state.pending ? '다시 제출' : '응답 제출';
  form.hidden = state.done; byId('complete-panel').hidden = !state.done;
}
function buildRecord(a) {
  const noDifficulty = a.difficulty === 1;
  return {
    id: state.id, study_version: VERSION, is_test: IS_TEST,
    payload: {
      schema_version: 2, kind: 'portal_experience_survey', study_mode: 'pilot', consent: a.consent,
      participant: { student_number: a.student_number.trim(), department: a.department.trim(), name: a.participant_name.trim() },
      answers: {
        portal_frequency: a.frequency, navigation_difficulty_frequency: a.difficulty,
        functions_not_applicable: noDifficulty,
        difficult_functions: noDifficulty ? [] : a.functions.map(item => ({
          id: item.id, recall_status: item.cannot_recall ? 'cannot_recall' : 'named', function_name: item.cannot_recall ? null : item.name.trim(),
          difficulty_reasons: { selected: [...item.reasons], other: item.reasons.includes('other') ? item.other_reason.trim() : null },
        })),
        perceived_navigation_ease: a.ease,
      },
      questionnaire: {
        frequency: Object.fromEntries(frequencyOptions),
        difficulty_scale: Object.fromEntries(difficultyOptions.map((label, i) => [i + 1, label])),
        reason_options: Object.fromEntries(reasonOptions),
        ease_scale: Object.fromEntries(easeOptions.map((label, i) => [i + 1, label])),
      },
      started_at: state.startedAt, submitted_at_client: new Date().toISOString(),
    },
  };
}
function update(event) {
  if (state.pending || state.done || submitting) return;
  if (event.target.matches('[data-cannot-recall]') && event.target.checked) event.target.closest('[data-function-row]').querySelector('[data-function-name]').value = '';
  state.answers = readFields();
  clearError(event.target.closest('[data-question]')?.dataset.question);
  persist(); syncUI();
}
form.addEventListener('input', update);
form.addEventListener('change', update);
form.addEventListener('click', event => {
  const target = event.target.closest('[data-action]');
  if (!target || state.pending || state.done || submitting || state.answers.difficulty === 1) return;
  state.answers = readFields();
  let focusId;
  if (target.dataset.action === 'add-function') {
    const item = newFunction(); state.answers.functions.push(item); focusId = item.id;
  } else if (target.dataset.action === 'remove-function' && state.answers.functions.length > 1) {
    const index = state.answers.functions.findIndex(item => item.id === target.dataset.functionId);
    if (index < 0) return;
    state.answers.functions.splice(index, 1);
    focusId = state.answers.functions[Math.min(index, state.answers.functions.length - 1)].id;
  } else return;
  persist(); renderFunctions(); syncUI();
  byId(`function-name-${focusId}`).focus({ preventScroll: true });
  byId(`function-name-${focusId}`).scrollIntoView({ block: 'nearest', behavior: 'instant' });
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (submitting || state.done) return;
  if (!state.pending) {
    state.answers = readFields();
    const errors = errorsFor(state.answers);
    if (errors.length) { showErrors(errors); return; }
    state.pending = buildRecord(state.answers); persist();
  }
  submitting = true; byId('submit-error').hidden = true; byId('validation-summary').hidden = true; syncUI();
  try {
    await sendResponse(study, state.pending);
    state.done = true; state.pending = null; state.completedAt = new Date().toISOString();
    persist(); syncUI(); byId('complete-title').focus();
    byId('complete-panel').scrollIntoView({ block: 'center', behavior: 'instant' });
    byId('announcer').textContent = '응답이 저장되었습니다.';
  } catch {
    byId('submit-error').textContent = '저장 완료를 확인하지 못했습니다. 연결 상태를 확인한 뒤 다시 제출해 주세요. 작성한 응답은 유지됩니다.';
    byId('submit-error').hidden = false;
  } finally { submitting = false; syncUI(); }
});
restoreFields(); syncUI(); persist();
