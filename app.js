import { study, cards, practiceCards } from './site-config.js';
import { sendResponse } from './supabase-client.js';

const app = document.querySelector('#app');
const announcer = document.querySelector('#announcer');
const isTest = study.mode !== 'live' || new URLSearchParams(location.search).get('test') === '1';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uuid = () => crypto.randomUUID();
const shuffle = input => {
  const result = [...input];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};
const fingerprint = Array.from(JSON.stringify(cards)).reduce((hash, c) => Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261).toString(16);
const storageKey = `hyu-card-sort:${study.version}:${fingerprint}:${isTest ? 'test' : 'live'}`;
const freshWorkspace = list => ({ groups: [], unknownIds: [], order: shuffle(list.map(card => card.id)) });
let storageAvailable = true;
let state;
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
  if (saved && saved.version === study.version && ['intro', 'practice', 'sort', 'review', 'done'].includes(saved.stage)) state = saved;
} catch { storageAvailable = false; }
state ||= {
  version: study.version, id: uuid(), stage: 'intro', consent: false,
  background: { year: '', frequency: '' },
  workspace: freshWorkspace(cards), practice: freshWorkspace(practiceCards),
  followup: { rationale: '', difficultIds: [], difficultReason: '', multipleIds: [], multipleReason: '' },
  startedAt: null, pending: null, receipt: null,
};
if (state.pending && state.stage !== 'done') state.stage = 'review';
let selected = new Set();
let mobileTab = 'pool';
let submitting = false;
let message = '';
let submitError = '';

function persist() {
  try { localStorage.setItem(storageKey, JSON.stringify(state)); }
  catch { storageAvailable = false; }
}

function announce(text) {
  announcer.textContent = '';
  requestAnimationFrame(() => { announcer.textContent = text; });
}

function go(stage) {
  state.stage = stage;
  selected.clear();
  message = '';
  persist();
  render();
  window.scrollTo({ top: 0, behavior: 'instant' });
  document.querySelector('h1')?.focus({ preventScroll: true });
}

const workspace = () => state.stage === 'practice' ? state.practice : state.workspace;
const catalog = () => state.stage === 'practice' ? practiceCards : cards;
const activeGroups = ws => ws.groups.filter(group => group.cardIds.length);
const placedCount = ws => ws.groups.reduce((sum, group) => sum + group.cardIds.length, 0);
function poolIds(ws) {
  const assigned = new Set(ws.groups.flatMap(group => group.cardIds));
  return ws.order.filter(id => !assigned.has(id) && !ws.unknownIds.includes(id));
}

function header() {
  const stageIndex = { intro: 0, practice: 0, sort: 1, review: 2, done: 3 }[state.stage];
  return `<header class="site-header"><div class="header-inner">
    <div class="brand"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span>${esc(study.title)}<small>한양대학교 · 인간공학과실습</small></span></div>
    <div class="header-right">${isTest ? '<span class="pilot-badge">회의용 시안</span>' : '<span class="live-badge">학생 참여 조사</span>'}<span class="save-status">${storageAvailable ? '이 기기에 자동 저장' : '기기 저장 사용 불가'}</span></div>
  </div></header>
  <nav class="stepper" aria-label="진행 단계">${['안내·연습', '카드 분류', '이유·확인', '제출 완료'].map((label, i) => `<span class="step ${stageIndex === i ? 'current' : ''} ${stageIndex > i ? 'finished' : ''}" ${stageIndex === i ? 'aria-current="step"' : ''}><b>${stageIndex > i ? '✓' : i + 1}</b>${label}</span>`).join('<span class="step-line" aria-hidden="true"></span>')}</nav>`;
}

function pilotNotice() {
  return isTest ? '<div class="pilot-notice"><span class="notice-dot"></span><span><strong>진행 방식 확인을 위한 시안이다.</strong> 카드 목록은 임시 구성이며, 제출 내용은 시험 응답으로 저장된다.</span></div>' : '';
}

function intro() {
  return `<main id="main" class="intro-main">
    ${pilotNotice()}
    <section class="hero"><div class="hero-copy"><p class="eyebrow">사용자의 분류 방식에서 시작하는 메뉴 설계</p>
      <h1 tabindex="-1">어떤 기능끼리<br>함께 두면 좋을까<span class="accent">?</span></h1>
      <p class="hero-description">포털의 기능을 관련 있다고 생각하는 것끼리 묶고,<br class="desktop-break"> 각 묶음에 어울리는 이름을 붙이는 조사이다.</p>
      <div class="hero-meta"><span><b>${cards.length}</b>개의 기능 카드</span><span>정답 없는 자유 분류</span><span>모바일 참여 가능</span></div>
    </div><div class="hero-art" aria-hidden="true"><div class="art-label">나의 기준으로, 자유롭게</div><div class="art-stack stack-a"><span></span><span></span><span></span></div><div class="art-stack stack-b"><span></span><span></span></div><div class="art-link">＋</div><div class="art-dot dot-one"></div><div class="art-dot dot-two"></div></div></section>
    <section class="instructions" aria-labelledby="instructions-title"><div class="section-heading"><h2 id="instructions-title">진행 방법</h2><p>기존 포털의 분류를 그대로 따를 필요는 없다.</p></div>
      <div class="instruction-grid"><article><span class="instruction-number">01</span><h3>관련 있는 카드를 고른다.</h3><p>명칭과 기능 설명을 읽고, 함께 두고 싶은 카드를 선택한다.</p></article><article><span class="instruction-number">02</span><h3>원하는 만큼 묶는다.</h3><p>묶음의 개수와 크기는 자유이다. 카드는 언제든 옮길 수 있다.</p></article><article><span class="instruction-number">03</span><h3>묶음에 이름을 붙인다.</h3><p>내용을 잘 나타내는 이름을 직접 적는다. 모르는 기능은 따로 남길 수 있다.</p></article></div>
    </section>
    <form data-form="intro" class="start-panel"><div><p class="eyebrow">시작하기 전에</p><h2>사용 경험을 간단히 확인한다.</h2><p class="muted">두 항목은 선택 사항이다. 이름과 연락처는 받지 않는다.</p></div>
      <div class="background-fields"><label>학년 <span class="optional">선택</span><select name="year"><option value="">선택하지 않음</option>${['1학년', '2학년', '3학년', '4학년 이상', '기타'].map(v => `<option ${state.background.year === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label>최근 한 달간 포털 이용 빈도 <span class="optional">선택</span><select name="frequency"><option value="">선택하지 않음</option>${['이용하지 않음', '월 1~3일', '주 1~2일', '주 3일 이상'].map(v => `<option ${state.background.frequency === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>
      <div class="consent-area"><p>${isTest ? '응답은 팀프로젝트의 조사 시안을 점검하는 데 사용한다.' : '응답은 팀프로젝트의 포털 메뉴 구조 연구와 분석에 사용한다.'} 제출 전까지 작성 내용을 수정할 수 있다. ${!isTest ? '이 조사에 참여한 경우 후속 메뉴 비교 실험에는 참여하지 않는다.' : ''}</p><label class="checkbox-label"><input type="checkbox" name="consent" required ${state.consent ? 'checked' : ''}><span>조사 안내를 확인했으며, 응답 제출에 동의한다.</span></label></div>
      <div class="start-action"><p>먼저 카드 4개로 조작을 연습한다.<br><span class="muted">연습 내용은 제출하지 않는다.</span></p><button class="button primary" type="submit">연습부터 시작하기 <span aria-hidden="true">→</span></button></div>
    </form>
  </main>`;
}

function renderCard(id, unknown = false) {
  const card = catalog().find(item => item.id === id);
  if (!card) return '';
  const isSelected = selected.has(id);
  return `<article class="function-card ${isSelected ? 'selected' : ''} ${unknown ? 'unknown-card' : ''}" data-card="${esc(id)}"><button type="button" class="card-select" data-action="select-card" data-id="${esc(id)}" data-focus="card-${esc(id)}" aria-pressed="${isSelected}"><span class="card-topline"><strong>${esc(card.label)}</strong><span class="checkmark" aria-hidden="true">${isSelected ? '✓' : ''}</span></span><span class="card-description">${esc(card.description)}</span></button>${state.stage !== 'practice' ? `<button type="button" class="unknown-toggle" data-action="toggle-unknown" data-id="${esc(id)}" data-focus="unknown-${esc(id)}">${unknown ? '분류할 카드로 되돌리기' : '뜻을 모르겠음'}</button>` : ''}</article>`;
}

function renderGroup(group, index) {
  return `<section class="group-panel" data-group="${esc(group.id)}"><div class="group-header"><span class="group-dot" aria-hidden="true"></span><label class="group-label"><span class="sr-only">${index + 1}번째 묶음 이름</span><input class="group-name" maxlength="60" placeholder="묶음 ${index + 1} 이름 입력" value="${esc(group.name)}" data-group-name="${esc(group.id)}" data-focus="group-name-${esc(group.id)}" autocomplete="off"></label><span class="group-count">${group.cardIds.length}개</span><button class="icon-button" type="button" data-action="dissolve-group" data-id="${esc(group.id)}" aria-label="${esc(group.name || `묶음 ${index + 1}`)} 풀기" title="묶음 풀기">×</button></div><div class="group-cards">${group.cardIds.length ? group.cardIds.map(id => renderCard(id)).join('') : '<p class="empty-group">카드를 선택한 뒤 이 묶음으로 이동할 수 있다.</p>'}</div></section>`;
}

function sorting() {
  const practice = state.stage === 'practice';
  const ws = workspace();
  const list = catalog();
  const remaining = poolIds(ws);
  const count = placedCount(ws);
  const resolved = count + ws.unknownIds.length;
  return `<main id="main" class="workspace-main ${practice ? 'practice-main' : ''}">
    <div class="workspace-heading"><div><p class="eyebrow">${practice ? '짧은 조작 연습 · 제출되지 않는 내용' : '카드 분류'}</p><h1 tabindex="-1">${practice ? '선택하고, 묶고, 이름 붙이기' : '관련 있는 기능끼리 묶는다.'}</h1><p class="muted">${practice ? '카드를 선택한 뒤 ‘새 묶음 만들기’를 누른다. 묶음의 이름도 적어볼 수 있다.' : '묶음 개수는 자유이다. 카드를 다시 선택하면 다른 묶음으로 옮길 수 있다.'}</p></div><div class="progress-summary"><span><b>${resolved}</b> / ${list.length}</span><small>분류 ${count}개${practice ? '' : ` · 뜻 모름 ${ws.unknownIds.length}개`}</small><div class="progress-track"><i style="width:${resolved / list.length * 100}%"></i></div></div></div>
    ${practice ? '<div class="practice-hint"><strong>연습 안내</strong><span>묶음 이름은 분류한 뒤 입력해도 된다. 충분히 익혔다면 본 분류로 넘어간다.</span></div>' : ''}
    <div class="mobile-tabs" role="tablist" aria-label="카드와 묶음 보기"><button type="button" role="tab" aria-selected="${mobileTab === 'pool'}" data-action="mobile-tab" data-tab="pool">미분류 <b>${remaining.length}</b></button><button type="button" role="tab" aria-selected="${mobileTab === 'groups'}" data-action="mobile-tab" data-tab="groups">내 묶음 <b>${ws.groups.length}</b></button></div>
    <div class="sorting-grid mobile-show-${mobileTab}"><section class="pool-panel" aria-labelledby="pool-title"><div class="panel-heading"><div><h2 id="pool-title">분류할 카드 <span>${remaining.length}</span></h2><p>함께 둘 카드를 여러 개 선택할 수 있다.</p></div><span class="small-icon" aria-hidden="true">▦</span></div><div class="pool-cards">${remaining.length ? remaining.map(id => renderCard(id)).join('') : '<div class="pool-empty"><span aria-hidden="true">✓</span><h3>분류할 카드가 없다.</h3><p>묶음의 이름과 내용을 확인하면 된다.</p></div>'}</div>
    ${ws.unknownIds.length ? `<div class="unknown-area"><h3>뜻을 모르겠는 기능 <span>${ws.unknownIds.length}</span></h3><p>억지로 분류할 필요는 없다. 이해했다면 다시 옮길 수 있다.</p>${ws.unknownIds.map(id => renderCard(id, true)).join('')}</div>` : ''}</section>
    <section class="groups-area" aria-labelledby="groups-title"><div class="panel-heading"><div><h2 id="groups-title">내가 만든 묶음 <span>${ws.groups.length}</span></h2><p>이름은 직접 입력한다. 자유롭게 바꿀 수 있다.</p></div></div><div class="groups-grid">${ws.groups.length ? ws.groups.map(renderGroup).join('') : '<div class="groups-empty"><div class="empty-cards" aria-hidden="true"><i></i><i></i><i></i></div><h3>나의 기준으로 첫 묶음을 만든다.</h3><p>함께 둘 카드를 선택한 뒤<br>‘새 묶음 만들기’를 누르면 된다.</p></div>'}</div></section></div>
    <div class="workspace-footer"><button type="button" class="text-button" data-action="${practice ? 'back-intro' : 'back-practice'}">← ${practice ? '안내로 돌아가기' : '연습 다시 보기'}</button><div><p class="workspace-message" role="status">${esc(message || (practice ? '연습을 건너뛰어도 본 분류에는 영향이 없다.' : remaining.length ? `아직 분류하지 않은 카드가 ${remaining.length}개이다.` : '각 묶음의 이름까지 확인한 뒤 다음으로 진행한다.'))}</p><button type="button" class="button primary" data-action="${practice ? 'start-sort' : 'review'}">${practice ? '본 분류 시작하기' : '분류 마치고 다음으로'} <span aria-hidden="true">→</span></button></div></div>
    <aside class="selection-toolbar" aria-label="선택한 카드 이동"><div class="selection-status"><b>${selected.size}</b><span>개 선택</span><button class="text-button" type="button" data-action="clear-selection" ${selected.size ? '' : 'disabled'}>선택 해제</button></div><div class="selection-actions"><button class="button primary new-group" type="button" data-action="new-group" ${selected.size ? '' : 'disabled'}><span aria-hidden="true">＋</span> 새 묶음 만들기</button><div class="move-controls"><label class="sr-only" for="move-target">옮길 묶음</label><select id="move-target" ${selected.size ? '' : 'disabled'}><option value="">이동할 곳 선택</option>${ws.groups.map((group, index) => `<option value="${esc(group.id)}">${esc(group.name || `묶음 ${index + 1}`)}</option>`).join('')}<option value="pool">미분류로 되돌리기</option></select><button class="button secondary" type="button" data-action="move" ${selected.size ? '' : 'disabled'}>이동</button></div></div></aside>
  </main>`;
}

function cardChecklist(name, picked) {
  return `<details class="card-picker"><summary>해당하는 기능 선택 <span>${picked.length}개 선택</span></summary><div class="card-picker-list">${state.workspace.order.map(id => {
    const card = cards.find(item => item.id === id);
    return `<label class="checkbox-label"><input type="checkbox" name="${name}" value="${esc(id)}" ${picked.includes(id) ? 'checked' : ''} ${state.pending ? 'disabled' : ''}><span>${esc(card.label)}</span></label>`;
  }).join('')}</div></details>`;
}

function groupSummary() {
  const ws = state.workspace;
  return `<div class="summary-groups">${activeGroups(ws).map(group => `<section class="summary-group"><h3>${esc(group.name)} <span>${group.cardIds.length}개</span></h3><ul>${group.cardIds.map(id => `<li>${esc(cards.find(card => card.id === id).label)}</li>`).join('')}</ul></section>`).join('')}${ws.unknownIds.length ? `<section class="summary-group summary-unknown"><h3>뜻을 모르겠는 기능 <span>${ws.unknownIds.length}개</span></h3><ul>${ws.unknownIds.map(id => `<li>${esc(cards.find(card => card.id === id).label)}</li>`).join('')}</ul></section>` : ''}</div>`;
}

function review() {
  const frozen = !!state.pending;
  return `<main id="main" class="review-main"><div class="review-heading"><p class="eyebrow">마지막 확인</p><h1 tabindex="-1">묶음의 기준을 짧게 남긴다.</h1><p class="muted">완성한 분류를 확인하고, 판단한 이유를 적으면 된다.</p></div>
    ${frozen ? '<div class="pending-notice"><strong>전송할 응답을 보관하고 있다.</strong> 다시 제출하면 동일한 응답으로 재시도한다. 중복 저장을 피하기 위해 내용 변경은 잠시 제한된다.</div>' : ''}
    <div class="review-grid"><form data-form="review" class="review-form"><fieldset ${frozen ? 'disabled' : ''}><legend class="sr-only">분류 이유</legend><div class="question"><label for="rationale"><span class="question-number">01</span>주로 어떤 기준으로 묶었는가? <span class="required-label">필수</span></label><p>자신이 사용한 기준을 한두 문장으로 적는다.</p><textarea id="rationale" name="rationale" rows="4" maxlength="1200" required placeholder="어떤 기능을 관련 있다고 판단했는지 자유롭게 작성한다.">${esc(state.followup.rationale)}</textarea></div>
    <div class="question"><label><span class="question-number">02</span>배치하기 어려웠던 기능이 있었는가? <span class="optional">선택</span></label><p>없었다면 넘어가도 된다.</p>${cardChecklist('difficultIds', state.followup.difficultIds)}<label class="subquestion" for="difficultReason">어떤 점에서 어려웠는가?</label><textarea id="difficultReason" name="difficultReason" rows="3" maxlength="1000" placeholder="명칭이 낯설었는지, 넣을 묶음이 애매했는지 등을 적는다.">${esc(state.followup.difficultReason)}</textarea></div>
    <div class="question"><label><span class="question-number">03</span>여러 묶음에 어울리는 기능이 있었는가? <span class="optional">선택</span></label><p>두 곳 이상에 놓고 싶었던 기능이 있다면 선택한다.</p>${cardChecklist('multipleIds', state.followup.multipleIds)}<label class="subquestion" for="multipleReason">어떤 묶음 사이에서 고민했는가?</label><textarea id="multipleReason" name="multipleReason" rows="3" maxlength="1000" placeholder="관련 있다고 생각한 묶음과 이유를 적는다.">${esc(state.followup.multipleReason)}</textarea></div></fieldset>
    <div class="submit-area">${isTest ? '<p class="test-submit-note">이 시안의 제출 내용은 시험 응답으로 구분된다.</p>' : ''}<p class="submit-error" role="alert">${esc(submitError)}</p><button class="button primary submit-button" type="submit" ${submitting ? 'disabled' : ''}>${submitting ? '<span class="spinner" aria-hidden="true"></span> 저장 확인 중' : frozen ? '같은 응답 다시 제출하기' : '응답 제출하기'}${submitting ? '' : '<span aria-hidden="true">→</span>'}</button><p class="muted small">${frozen ? '작성 내용은 이 기기에 보관되어 있다.' : '제출 후에는 응답을 수정할 수 없다.'}</p></div></form>
    <aside class="summary-panel"><div class="summary-title"><h2>내 분류 결과</h2><button class="text-button" type="button" data-action="edit-sort" ${frozen ? 'disabled' : ''}>수정하기</button></div><p class="summary-meta">${activeGroups(state.workspace).length}개 묶음 · 기능 ${cards.length}개</p>${groupSummary()}</aside></div>
    <button class="text-button review-back" type="button" data-action="edit-sort" ${frozen ? 'disabled' : ''}>← 카드 분류로 돌아가기</button></main>`;
}

function complete() {
  return `<main id="main" class="complete-main"><div class="complete-check" aria-hidden="true">✓</div><p class="eyebrow">응답 제출 완료</p><h1 tabindex="-1">분류 결과가 저장되었다.</h1><p>남긴 분류와 이유는 ${isTest ? '조사 시안을 보완하는 데' : '포털 메뉴 개선안을 설계하는 데'} 사용한다.<br>참여에 감사한다.</p><div class="complete-stats"><div><b>${activeGroups(state.workspace).length}</b><span>직접 만든 묶음</span></div><div><b>${placedCount(state.workspace)}</b><span>분류한 기능</span></div><div><b>${state.workspace.unknownIds.length}</b><span>뜻을 모르는 기능</span></div></div>${isTest ? '<div class="pilot-notice"><span class="notice-dot"></span><span>시험 응답으로 저장되었다. 실제 연구 응답과 구분된다.</span></div>' : '<p class="completion-reminder">이 조사에 참여했으므로 후속 메뉴 비교 실험에는 참여하지 않는다.</p>'}<details class="completed-summary"><summary>제출한 분류 다시 보기</summary>${groupSummary()}</details><p class="muted small">이 창을 닫아도 된다.</p></main>`;
}

function render() {
  const focused = document.activeElement?.dataset?.focus;
  const body = state.stage === 'intro' ? intro() : ['practice', 'sort'].includes(state.stage) ? sorting() : state.stage === 'review' ? review() : complete();
  app.innerHTML = header() + body + `<footer class="site-footer"><span>한양대학교 인간공학과실습 팀프로젝트</span><span>PORTAL MENU STUDY</span></footer>`;
  document.body.dataset.stage = state.stage;
  if (focused) document.querySelector(`[data-focus="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });
}

function moveSelected(target) {
  const ws = workspace();
  const ids = [...selected];
  if (!ids.length) return;
  if (!['pool', 'unknown'].includes(target) && !ws.groups.some(group => group.id === target)) return;
  ws.groups.forEach(group => { group.cardIds = group.cardIds.filter(id => !selected.has(id)); });
  ws.unknownIds = ws.unknownIds.filter(id => !selected.has(id));
  if (target === 'unknown') ws.unknownIds.push(...ids);
  else if (target !== 'pool') ws.groups.find(group => group.id === target).cardIds.push(...ids);
  selected.clear();
  message = `${ids.length}개 카드를 ${target === 'pool' ? '미분류로 되돌렸다.' : target === 'unknown' ? '뜻을 모르겠는 기능으로 표시했다.' : '옮겼다.'}`;
  persist();
  render();
  announce(message);
}

function validateWorkspace() {
  if (poolIds(state.workspace).length) return '남은 카드를 묶거나 ‘뜻을 모르겠음’으로 표시해야 한다.';
  if (activeGroups(state.workspace).some(group => !group.name.trim())) return '카드가 들어 있는 모든 묶음에 이름을 입력해야 한다.';
  return '';
}

function buildRecord() {
  return {
    id: state.id, study_version: study.version, is_test: isTest,
    payload: {
      schema_version: 1,
      study_mode: study.mode,
      consent: state.consent,
      background: { ...state.background },
      cards: cards.map(card => ({ ...card })),
      presentation_order: [...state.workspace.order],
      groups: activeGroups(state.workspace).map(group => ({ id: group.id, name: group.name.trim(), card_ids: [...group.cardIds] })),
      unknown_card_ids: [...state.workspace.unknownIds],
      followup: { ...state.followup, rationale: state.followup.rationale.trim() },
      started_at: state.startedAt,
      submitted_at_client: new Date().toISOString(),
      total_duration_seconds: state.startedAt ? Math.round((Date.now() - Date.parse(state.startedAt)) / 1000) : null,
    },
  };
}

app.addEventListener('input', event => {
  const field = event.target;
  if (state.pending || state.stage === 'done') return;
  if (field.dataset.groupName) {
    const group = workspace().groups.find(item => item.id === field.dataset.groupName);
    if (group) group.name = field.value;
    const option = document.querySelector(`#move-target option[value="${CSS.escape(field.dataset.groupName)}"]`);
    if (option) option.textContent = field.value || '이름을 입력하지 않은 묶음';
  } else if (['rationale', 'difficultReason', 'multipleReason'].includes(field.name)) state.followup[field.name] = field.value;
  persist();
});

app.addEventListener('change', event => {
  const field = event.target;
  if (state.pending || state.stage === 'done') return;
  if (['year', 'frequency'].includes(field.name)) state.background[field.name] = field.value;
  else if (field.name === 'consent') state.consent = field.checked;
  else if (['difficultIds', 'multipleIds'].includes(field.name)) {
    const values = new Set(state.followup[field.name]);
    field.checked ? values.add(field.value) : values.delete(field.value);
    state.followup[field.name] = [...values];
    field.closest('details').querySelector('summary span').textContent = `${values.size}개 선택`;
  }
  persist();
});

app.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const { action, id } = button.dataset;
  if (action === 'back-intro') return go('intro');
  if (action === 'start-sort') { mobileTab = 'pool'; return go('sort'); }
  if (action === 'back-practice') return go('practice');
  if (action === 'edit-sort' && !state.pending) return go('sort');
  if (state.pending || !['practice', 'sort'].includes(state.stage)) return;
  if (action === 'select-card') {
    selected.has(id) ? selected.delete(id) : selected.add(id);
    message = '';
    render();
    announce(`${selected.size}개 카드를 선택했다.`);
  } else if (action === 'clear-selection') { selected.clear(); render(); }
  else if (action === 'mobile-tab') { mobileTab = button.dataset.tab; render(); }
  else if (action === 'new-group') {
    if (!selected.size) return;
    const group = { id: uuid(), name: '', cardIds: [] };
    workspace().groups.push(group);
    mobileTab = 'groups';
    moveSelected(group.id);
    document.querySelector(`[data-group-name="${group.id}"]`)?.focus();
  } else if (action === 'move') {
    const target = document.querySelector('#move-target').value;
    if (target) moveSelected(target);
    else { message = '먼저 이동할 곳을 선택해야 한다.'; render(); }
  } else if (action === 'toggle-unknown') {
    const back = workspace().unknownIds.includes(id);
    selected = new Set([id]);
    moveSelected(back ? 'pool' : 'unknown');
  } else if (action === 'dissolve-group') {
    const group = workspace().groups.find(item => item.id === id);
    if (!group) return;
    if (group.cardIds.length && !window.confirm('이 묶음을 풀고 포함된 카드를 미분류로 되돌릴 것인가?')) return;
    group.cardIds.forEach(cardId => selected.delete(cardId));
    workspace().groups = workspace().groups.filter(item => item.id !== id);
    persist(); render(); announce('묶음을 풀었다. 포함된 카드는 미분류로 돌아갔다.');
  } else if (action === 'review') {
    message = validateWorkspace();
    if (message) { render(); announce(message); return; }
    go('review');
  }
});

app.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.target;
  if (form.dataset.form === 'intro') {
    if (!state.consent) return;
    state.startedAt ||= new Date().toISOString();
    mobileTab = 'pool';
    return go('practice');
  }
  if (form.dataset.form !== 'review' || submitting || state.stage !== 'review') return;
  if (!state.pending) {
    if (validateWorkspace() || !state.followup.rationale.trim()) {
      submitError = '분류와 묶음 이름, 필수 응답을 확인해야 한다.';
      render(); return;
    }
    state.pending = buildRecord();
    persist();
  }
  submitting = true; submitError = ''; render();
  try {
    await sendResponse(study, state.pending);
    state.receipt = { id: state.id, confirmedAt: new Date().toISOString() };
    state.pending = null;
    state.stage = 'done';
    persist();
    render();
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.querySelector('h1')?.focus({ preventScroll: true });
    announce('응답이 정상적으로 저장되었다.');
  } catch {
    submitError = '저장 완료를 확인하지 못했다. 연결 상태를 확인한 뒤 다시 제출하면 된다. 작성 내용은 유지된다.';
  } finally {
    submitting = false;
    render();
  }
});

persist();
render();
