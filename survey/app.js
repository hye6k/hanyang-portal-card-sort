import { study } from '../site-config.js';
import { sendResponse } from '../supabase-client.js';

const VERSION = 'portal-experience-survey-2026-11-14-v1';
const STORAGE_KEY = `hyu-portal-survey:${VERSION}`;
// Standalone pilot: all responses stay distinguishable from the research data.
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
const reset = document.querySelector('#reset-button');
const byId = id => document.getElementById(id);
const named = name => form.elements.namedItem(name);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fresh = () => ({ version: VERSION, id: crypto.randomUUID(), startedAt: new Date().toISOString(), answers: {}, pending: null, done: false });
let state = fresh();
let storageAvailable = true;
let submitting = false;
try {
  const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
  if (saved?.version === VERSION && saved.answers && typeof saved.id === 'string') state = saved;
} catch { storageAvailable = false; }
function persist() {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { storageAvailable = false; }
}
function radioOptions(name, list, scale = false) {
  return list.map(([value, label]) => `<label class="${scale ? 'scale-option' : 'choice'}"><input type="radio" name="${name}" value="${value}" required>${scale ? `<span class="scale-number">${value}</span><span class="scale-label">${esc(label)}</span>` : `<span>${esc(label)}</span>`}</label>`).join('');
}
byId('frequency-options').innerHTML = radioOptions('frequency', frequencyOptions);
byId('difficulty-options').innerHTML = radioOptions('difficulty', difficultyOptions.map((label, i) => [i + 1, label]), true);
byId('ease-options').innerHTML = radioOptions('ease', easeOptions.map((label, i) => [i + 1, label]), true);
byId('reason-options').innerHTML = reasonOptions.map(([value, label]) => `<label class="choice"><input type="checkbox" name="reasons" value="${value}"><span>${esc(label)}</span></label>`).join('');

function restoreFields() {
  const a = state.answers;
  for (const name of ['student_number', 'department', 'participant_name', 'hardest_function', 'other_reason']) named(name).value = typeof a[name] === 'string' ? a[name] : '';
  for (const name of ['frequency', 'difficulty', 'ease']) for (const el of form.querySelectorAll(`[name="${name}"]`)) el.checked = el.value === String(a[name] || '');
  for (const el of form.querySelectorAll('[name="reasons"]')) el.checked = Array.isArray(a.reasons) && a.reasons.includes(el.value);
  named('cannot_recall').checked = !!a.cannot_recall;
  named('consent').checked = !!a.consent;
}
function readFields() {
  const chosen = name => form.querySelector(`[name="${name}"]:checked`)?.value || '';
  return {
    student_number: named('student_number').value,
    department: named('department').value,
    participant_name: named('participant_name').value,
    frequency: chosen('frequency'), difficulty: Number(chosen('difficulty')) || null,
    hardest_function: named('hardest_function').value, cannot_recall: named('cannot_recall').checked,
    reasons: [...form.querySelectorAll('[name="reasons"]:checked')].map(el => el.value),
    other_reason: named('other_reason').value, ease: Number(chosen('ease')) || null,
    consent: named('consent').checked,
  };
}
function errorsFor(a) {
  const errors = [];
  if (![a.student_number, a.department, a.participant_name].every(v => v?.trim())) errors.push(['participant', '학번, 학과, 이름을 모두 입력해야 한다.']);
  if (!frequencyOptions.some(([value]) => value === a.frequency)) errors.push(['frequency', '이용 빈도를 선택해야 한다.']);
  if (![1, 2, 3, 4, 5].includes(a.difficulty)) errors.push(['difficulty', '어려움을 겪은 빈도를 선택해야 한다.']);
  if (a.difficulty !== 1) {
    if (!a.cannot_recall && !a.hardest_function?.trim()) errors.push(['hardest', '기능명을 입력하거나 ‘기억나지 않음’을 선택해야 한다.']);
    if (!a.reasons?.length) errors.push(['reasons', '어려웠던 이유를 하나 이상 선택해야 한다.']);
    else if (a.reasons.includes('other') && !a.other_reason?.trim()) errors.push(['reasons', '기타 이유를 입력해야 한다.']);
  }
  if (![1, 2, 3, 4, 5].includes(a.ease)) errors.push(['ease', '원하는 기능을 쉽게 찾을 수 있는지 선택해야 한다.']);
  if (!a.consent) errors.push(['consent', '정보 수집과 응답 제출에 동의해야 제출할 수 있다.']);
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
    byId(`${key}-error`).textContent = message;
    byId(`${key}-error`).hidden = false;
  }
  byId('validation-summary').textContent = '표시된 문항을 확인한 뒤 제출해야 한다.';
  byId('validation-summary').hidden = !errors.length;
  if (errors.length) {
    const first = form.querySelector(`[data-question="${errors[0][0]}"]`);
    first.querySelector('input:not(:disabled),textarea:not(:disabled)')?.focus({ preventScroll: true });
    first.scrollIntoView({ block: 'center', behavior: 'instant' });
  }
}
function syncUI() {
  const a = state.answers, noDifficulty = a.difficulty === 1;
  const frozen = submitting || !!state.pending;
  fields.disabled = frozen;
  for (const key of ['hardest', 'reasons']) {
    const section = form.querySelector(`[data-question="${key}"]`);
    section.dataset.skipped = String(noDifficulty);
    byId(`${key}-skipped`).hidden = !noDifficulty;
    byId(`${key}-fields`).hidden = noDifficulty;
    byId(`${key}-fields`).disabled = noDifficulty;
    if (noDifficulty) clearError(key);
  }
  named('hardest_function').disabled = noDifficulty || !!a.cannot_recall;
  byId('other-field').hidden = !a.reasons?.includes('other');
  named('other_reason').disabled = noDifficulty || !a.reasons?.includes('other');
  const validKeys = new Set(errorsFor({ ...a, consent: true }).map(([key]) => key));
  byId('answered-count').textContent = 6 - validKeys.size;
  byId('save-note').textContent = storageAvailable ? '작성 내용은 이 탭에 임시 저장된다.' : '이 탭을 유지하면 작성을 이어갈 수 있다.';
  byId('pending-note').hidden = !state.pending || submitting;
  reset.disabled = frozen;
  reset.textContent = state.done ? '새 시험 응답 작성' : '작성 내용 초기화';
  button.disabled = submitting;
  button.textContent = submitting ? '저장 중…' : state.pending ? '다시 제출' : '응답 제출';
  form.hidden = state.done;
  byId('complete-panel').hidden = !state.done;
}
function buildRecord(a) {
  const noDifficulty = a.difficulty === 1;
  return {
    id: state.id, study_version: VERSION, is_test: IS_TEST,
    payload: {
      schema_version: 1, kind: 'portal_experience_survey', study_mode: 'pilot', consent: a.consent,
      participant: { student_number: a.student_number.trim(), department: a.department.trim(), name: a.participant_name.trim() },
      answers: {
        portal_frequency: a.frequency, navigation_difficulty_frequency: a.difficulty,
        hardest_function: {
          status: noDifficulty ? 'not_applicable' : a.cannot_recall ? 'cannot_recall' : 'named',
          name: noDifficulty || a.cannot_recall ? null : a.hardest_function.trim(),
        },
        difficulty_reasons: {
          not_applicable: noDifficulty, selected: noDifficulty ? [] : [...a.reasons],
          other: !noDifficulty && a.reasons.includes('other') ? a.other_reason.trim() : null,
        },
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
  if (event.target.name === 'cannot_recall' && event.target.checked) named('hardest_function').value = '';
  state.answers = readFields();
  clearError(event.target.closest('[data-question]')?.dataset.question);
  persist(); syncUI();
}
form.addEventListener('input', update);
form.addEventListener('change', update);
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (submitting || state.done) return;
  if (!state.pending) {
    state.answers = readFields();
    const errors = errorsFor(state.answers);
    if (errors.length) { showErrors(errors); return; }
    state.pending = buildRecord(state.answers);
    persist();
  }
  submitting = true;
  byId('submit-error').hidden = true;
  byId('validation-summary').hidden = true;
  syncUI();
  try {
    await sendResponse(study, state.pending);
    state.done = true; state.pending = null; state.completedAt = new Date().toISOString();
    persist(); syncUI();
    byId('complete-title').focus();
    byId('complete-panel').scrollIntoView({ block: 'center', behavior: 'instant' });
    byId('announcer').textContent = '응답이 저장되었다.';
  } catch {
    byId('submit-error').textContent = '저장 완료를 확인하지 못했다. 연결 상태를 확인한 뒤 다시 제출하면 된다. 작성한 응답은 유지된다.';
    byId('submit-error').hidden = false;
  } finally { submitting = false; syncUI(); }
});
reset.addEventListener('click', () => {
  if (state.pending || submitting) return;
  state = fresh(); persist(); form.reset(); restoreFields();
  form.querySelectorAll('[data-question]').forEach(el => clearError(el.dataset.question));
  byId('submit-error').hidden = true;
  syncUI(); window.scrollTo({ top: 0, behavior: 'instant' });
});
restoreFields(); syncUI(); persist();
