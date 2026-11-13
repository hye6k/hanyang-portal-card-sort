import { cardNames } from './cards.js';

const cards = cardNames.map((name, index) => ({ id: `card-${index + 1}`, name }));
const app = document.querySelector('#app');
const moveDialog = document.querySelector('#move-dialog');
const confirmDialog = document.querySelector('#confirm-dialog');
const announcer = document.querySelector('#announcer');
const toast = document.querySelector('#toast');
const storageKey = 'hyu-grouping-ui-test-v1';
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const shuffle = values => {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};
const fresh = () => ({ order: shuffle(cards.map(card => card.id)), groups: [], nextGroup: 1 });
const validCard = id => cards.some(card => card.id === id);
function validState(value) {
  if (!value || !Array.isArray(value.order) || value.order.length !== cards.length || new Set(value.order).size !== cards.length || !value.order.every(validCard) || !Array.isArray(value.groups)) return false;
  const ids = [];
  if (!value.groups.every(group => typeof group.id === 'string' && typeof group.name === 'string' && group.name.length <= 60 && Array.isArray(group.cardIds) && group.cardIds.every(validCard))) return false;
  value.groups.forEach(group => ids.push(...group.cardIds));
  return new Set(ids).size === ids.length && new Set(value.groups.map(group => group.id)).size === value.groups.length && Number.isInteger(value.nextGroup) && value.nextGroup > 0;
}
let state;
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
  if (validState(saved)) state = saved;
} catch { /* 기기 저장을 사용할 수 없어도 분류를 진행할 수 있다. */ }
state ||= fresh();
let selected = new Set();
let view = 'cards';
let toastTimer;
let pendingConfirmation;

function save() {
  try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* 현재 창에서는 계속 동작한다. */ }
}

function announce(text) {
  announcer.textContent = '';
  requestAnimationFrame(() => { announcer.textContent = text; });
}

function notify(text) {
  clearTimeout(toastTimer);
  toast.textContent = text;
  toast.classList.add('visible');
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2800);
}

function remainingCards() {
  const assigned = new Set(state.groups.flatMap(group => group.cardIds));
  return state.order.filter(id => !assigned.has(id));
}

function groupName(group) {
  const index = state.groups.indexOf(group);
  return group.name.trim() || `묶음 ${index + 1}`;
}

function cardHTML(id) {
  const card = cards.find(item => item.id === id);
  const checked = selected.has(id);
  return `<button type="button" class="card ${checked ? 'selected' : ''}" data-action="select" data-id="${id}" data-focus="${id}" aria-pressed="${checked}"><span class="card-name">${escape(card.name)}</span><span class="check" aria-hidden="true">${checked ? '✓' : ''}</span></button>`;
}

function render() {
  const focused = document.activeElement?.dataset?.focus;
  const oldPoolScroll = document.querySelector('.pool-scroll')?.scrollTop || 0;
  const oldGroupsScroll = document.querySelector('.groups-scroll')?.scrollTop || 0;
  const pool = remainingCards();
  const placed = cards.length - pool.length;
  app.innerHTML = `<section class="intro"><div><p class="eyebrow">명칭만 있는 카드 30개</p><h1>관련 있는 카드끼리 묶는다.</h1><p class="instruction">카드를 여러 개 선택한 뒤 <strong>새 묶음</strong>을 만든다.<br class="mobile-break"> 만든 묶음으로 카드를 옮길 수도 있다.</p></div><div class="progress"><span><b>${placed}</b><span> / 30</span></span><small>분류한 카드</small><div class="progress-track"><i style="width:${placed / 30 * 100}%"></i></div></div></section>
    <nav class="workspace-nav" aria-label="분류 화면 전환"><div class="tabs" role="tablist"><button type="button" role="tab" id="cards-tab" aria-controls="cards-panel" aria-selected="${view === 'cards'}" data-action="view" data-view="cards">카드 <span>${pool.length}</span></button><button type="button" role="tab" id="groups-tab" aria-controls="groups-panel" aria-selected="${view === 'groups'}" data-action="view" data-view="groups">내 묶음 <span>${state.groups.length}</span></button></div><p class="workspace-hint">묶음 개수는 자유이다.</p></nav>
    <div class="board show-${view}"><section class="pool-panel" id="cards-panel" aria-labelledby="pool-heading"><div class="panel-heading"><h2 id="pool-heading">아직 묶지 않은 카드 <span>${pool.length}</span></h2>${pool.length ? `<button class="plain-button" type="button" data-action="select-pool">${pool.every(id => selected.has(id)) ? '선택 해제' : '모두 선택'}</button>` : ''}</div><div class="pool-scroll"><div class="card-grid">${pool.map(cardHTML).join('')}</div>${pool.length ? '<p class="scroll-hint">아래로 스크롤해 나머지 카드를 확인할 수 있다.</p>' : `<div class="pool-empty"><span aria-hidden="true">✓</span><h3>모든 카드를 묶었다.</h3><p>묶음에서 카드를 다시 선택해 옮길 수 있다.</p><button type="button" class="empty-view-button" data-action="view" data-view="groups">내 묶음 보기 <span aria-hidden="true">→</span></button></div>`}</div></section>
    <section class="groups-panel" id="groups-panel" aria-labelledby="group-heading"><div class="panel-heading"><h2 id="group-heading">내가 만든 묶음 <span>${state.groups.length}</span></h2><span class="rename-hint">이름을 눌러 수정</span></div><div class="groups-scroll"><div class="group-grid">${state.groups.length ? state.groups.map((group, index) => `<section class="group" data-group="${escape(group.id)}"><div class="group-heading"><span class="group-dot color-${index % 4}" aria-hidden="true"></span><label class="group-name-label"><span class="sr-only">${index + 1}번째 묶음 이름</span><input type="text" class="group-name" value="${escape(group.name)}" maxlength="60" placeholder="묶음 이름" data-rename="${escape(group.id)}" data-focus="name-${escape(group.id)}" autocomplete="off"></label><span class="group-size">${group.cardIds.length}</span><button type="button" class="dissolve" data-action="dissolve" data-id="${escape(group.id)}" aria-label="${escape(groupName(group))} 풀기" title="묶음 풀기">×</button></div><div class="group-cards">${group.cardIds.length ? group.cardIds.map(cardHTML).join('') : '<p class="empty-group">선택한 카드를 이 묶음으로 옮길 수 있다.</p>'}</div></section>`).join('') : '<div class="groups-empty"><span class="empty-illustration" aria-hidden="true"><i></i><i></i><i></i></span><h3>아직 만든 묶음이 없다.</h3><p>함께 둘 카드를 선택한 뒤<br>아래의 <strong>새 묶음</strong>을 누르면 된다.</p><button type="button" class="empty-view-button" data-action="view" data-view="cards">카드 선택하러 가기 <span aria-hidden="true">→</span></button></div>'}</div></div></section></div>
    <aside class="action-bar" aria-label="선택한 카드 묶기"><div class="selection-info"><span class="selection-count"><b>${selected.size}</b>개 선택</span><button type="button" class="plain-button clear-selection" data-action="clear" ${selected.size ? '' : 'disabled'}>선택 해제</button><span class="selection-help">${selected.size ? '선택한 카드로 묶음을 만들거나 이동한다.' : '함께 둘 카드를 선택한다.'}</span></div><div class="actions"><button type="button" class="action-button secondary" data-action="open-move" ${selected.size && state.groups.length ? '' : 'disabled'}><span aria-hidden="true">↗</span> 옮기기</button><button type="button" class="action-button primary" data-action="create" ${selected.size ? '' : 'disabled'}><span aria-hidden="true">＋</span> 새 묶음</button></div></aside>`;
  const poolScroll = document.querySelector('.pool-scroll');
  const groupsScroll = document.querySelector('.groups-scroll');
  if (poolScroll) poolScroll.scrollTop = oldPoolScroll;
  if (groupsScroll) groupsScroll.scrollTop = oldGroupsScroll;
  if (focused) document.querySelector(`[data-focus="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });
}

function assign(destination) {
  const ids = [...selected];
  if (!ids.length || (destination !== 'pool' && !state.groups.some(group => group.id === destination))) return;
  for (const group of state.groups) group.cardIds = group.cardIds.filter(id => !selected.has(id));
  if (destination !== 'pool') state.groups.find(group => group.id === destination).cardIds.push(...ids);
  selected.clear();
  save();
  render();
  const name = destination === 'pool' ? '미분류 카드' : groupName(state.groups.find(group => group.id === destination));
  notify(`${ids.length}개 카드를 ‘${name}’으로 옮겼다.`);
  announce(`${ids.length}개 카드 이동 완료`);
}

function openMove() {
  moveDialog.innerHTML = `<div class="sheet-handle" aria-hidden="true"></div><div class="sheet-heading"><div><p class="eyebrow">${selected.size}개 카드 선택</p><h2 id="move-title">어디로 옮길까?</h2></div><button type="button" class="close-dialog" data-action="close-move" aria-label="이동 창 닫기">×</button></div><div class="destinations">${state.groups.map(group => `<button type="button" class="destination" data-action="destination" data-id="${escape(group.id)}"><span class="destination-icon" aria-hidden="true">▤</span><span>${escape(groupName(group))}</span><small>${group.cardIds.length}개</small><span class="destination-arrow" aria-hidden="true">→</span></button>`).join('')}<button type="button" class="destination return-pool" data-action="destination" data-id="pool"><span class="destination-icon" aria-hidden="true">↩</span><span>미분류로 되돌리기</span><span class="destination-arrow" aria-hidden="true">→</span></button></div>`;
  moveDialog.showModal();
}

function confirmAction(title, description, action) {
  pendingConfirmation = action;
  confirmDialog.innerHTML = `<h2 id="confirm-title">${escape(title)}</h2><p>${escape(description)}</p><div class="confirm-actions"><button type="button" class="action-button secondary" data-action="cancel-confirm" autofocus>취소</button><button type="button" class="action-button primary" data-action="confirm">${action.kind === 'reset' ? '처음부터' : '묶음 풀기'}</button></div>`;
  confirmDialog.showModal();
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const { action, id } = button.dataset;
  if (action === 'select') {
    selected.has(id) ? selected.delete(id) : selected.add(id);
    render(); announce(`${selected.size}개 카드 선택`);
  } else if (action === 'clear') { selected.clear(); render(); }
  else if (action === 'view') {
    view = button.dataset.view;
    render();
    document.querySelector('.workspace-nav').scrollIntoView({ block: 'start' });
  } else if (action === 'select-pool') {
    const pool = remainingCards();
    const all = pool.every(cardId => selected.has(cardId));
    pool.forEach(cardId => all ? selected.delete(cardId) : selected.add(cardId));
    render(); announce(`${selected.size}개 카드 선택`);
  } else if (action === 'create' && selected.size) {
    const group = { id: crypto.randomUUID(), name: `묶음 ${state.nextGroup++}`, cardIds: [] };
    state.groups.push(group);
    view = 'groups';
    assign(group.id);
    requestAnimationFrame(() => {
      const target = document.querySelector(`[data-group="${group.id}"]`);
      target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  } else if (action === 'open-move') openMove();
  else if (action === 'close-move') moveDialog.close();
  else if (action === 'destination') { moveDialog.close(); assign(id); }
  else if (action === 'dissolve') {
    const group = state.groups.find(item => item.id === id);
    confirmAction('이 묶음을 풀까?', `‘${groupName(group)}’의 카드 ${group.cardIds.length}개가 미분류로 돌아간다.`, { kind: 'dissolve', id });
  } else if (action === 'reset') confirmAction('처음부터 다시 묶을까?', '지금 만든 묶음이 지워지고 카드 30개가 미분류로 돌아간다.', { kind: 'reset' });
  else if (action === 'cancel-confirm') confirmDialog.close();
  else if (action === 'confirm') {
    confirmDialog.close();
    if (pendingConfirmation?.kind === 'reset') { state = fresh(); selected.clear(); view = 'cards'; }
    else if (pendingConfirmation?.kind === 'dissolve') {
      const group = state.groups.find(item => item.id === pendingConfirmation.id);
      group?.cardIds.forEach(cardId => selected.delete(cardId));
      state.groups = state.groups.filter(item => item.id !== pendingConfirmation.id);
    }
    pendingConfirmation = null;
    save(); render();
  }
});

app.addEventListener('input', event => {
  const id = event.target.dataset.rename;
  if (!id) return;
  const group = state.groups.find(item => item.id === id);
  if (!group) return;
  group.name = event.target.value;
  save();
});

app.addEventListener('keydown', event => {
  if (event.target.dataset.rename && event.key === 'Enter') { event.preventDefault(); event.target.blur(); }
  if (event.target.getAttribute('role') === 'tab' && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
    event.preventDefault();
    view = view === 'cards' ? 'groups' : 'cards';
    render();
    document.querySelector(`[role="tab"][aria-selected="true"]`)?.focus();
  }
});

for (const dialog of [moveDialog, confirmDialog]) {
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
}

save();
render();
