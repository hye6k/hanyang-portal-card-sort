import { cardNames } from '../test/cards.js';

const cards = cardNames.map((name, index) => ({ id: `card-${index + 1}`, name }));
const app = document.querySelector('#app');
const ghost = document.querySelector('#drag-ghost');
const dragHint = document.querySelector('#drag-hint');
const toast = document.querySelector('#toast');
const announcer = document.querySelector('#announcer');
const confirmation = document.querySelector('#confirmation');
const storageKey = 'hyu-drag-grouping-v1';
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = values => {
  const output = [...values];
  for (let i = output.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [output[i], output[j]] = [output[j], output[i]]; }
  return output;
};
const fresh = () => ({ order: shuffle(cards.map(card => card.id)), groups: [], nextGroup: 1 });
function valid(value) {
  if (!value || !Array.isArray(value.order) || value.order.length !== cards.length || new Set(value.order).size !== cards.length || !value.order.every(id => cards.some(card => card.id === id)) || !Array.isArray(value.groups) || !Number.isInteger(value.nextGroup) || value.nextGroup < 1) return false;
  const all = [];
  if (!value.groups.every(group => typeof group.id === 'string' && typeof group.name === 'string' && group.name.length <= 60 && Array.isArray(group.cardIds) && group.cardIds.length && group.cardIds.every(id => value.order.includes(id)))) return false;
  value.groups.forEach(group => all.push(...group.cardIds));
  return new Set(all).size === all.length && new Set(value.groups.map(group => group.id)).size === value.groups.length;
}
let state;
try { const value = JSON.parse(localStorage.getItem(storageKey) || 'null'); if (valid(value)) state = value; } catch {}
state ||= fresh();
let history = [];
let pointer = null;
let keyboardSource = null;
let frame = null;
let target = null;
let toastTimer;
let confirmOperation;
let ignoreClicksUntil = 0;
const groupForCard = id => state.groups.find(group => group.cardIds.includes(id));
const groupForId = id => state.groups.find(group => group.id === id);
const cardForId = id => cards.find(card => card.id === id);
const groupName = group => group.name.trim() || `묶음 ${state.groups.indexOf(group) + 1}`;

function save() { try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch {} }
function checkpoint() { history.push(JSON.stringify(state)); if (history.length > 20) history.shift(); }
function announce(text) { announcer.textContent = ''; requestAnimationFrame(() => { announcer.textContent = text; }); }
function notify(text) {
  clearTimeout(toastTimer); toast.textContent = text; toast.classList.add('visible');
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2600); announce(text);
}
function sourceName(source) { return source.kind === 'card' ? cardForId(source.id).name : groupName(groupForId(source.id)); }
function grip(kind, id, label) {
  return `<button type="button" class="grip" data-handle data-kind="${kind}" data-id="${escape(id)}" data-focus="${kind}-${escape(id)}" aria-label="${escape(label)} 끌어 옮기기" aria-describedby="keyboard-help"><span aria-hidden="true">⠿</span></button>`;
}
function cardHTML(id) {
  const card = cardForId(id);
  return `<div class="card" data-node="card" data-id="${id}"><span class="card-label">${escape(card.name)}</span>${grip('card', id, card.name)}</div>`;
}

function render() {
  const focused = document.activeElement?.dataset?.focus;
  const positions = [...document.querySelectorAll('[data-scroll]')].map(el => [el.dataset.scroll, el.scrollTop]);
  const assigned = new Set(state.groups.flatMap(group => group.cardIds));
  const pool = state.order.filter(id => !assigned.has(id));
  app.innerHTML = `<header class="header"><div class="header-inner"><div class="brand"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span><strong>카드 합치기</strong><span class="badge">드래그 테스트</span></div><div class="header-actions"><button type="button" data-action="undo" class="quiet-button" ${history.length ? '' : 'disabled'}><span aria-hidden="true">↶</span> 되돌리기</button><button type="button" data-action="reset" class="reset-button">처음부터</button></div></div></header>
    <main id="main"><section class="intro"><div><p class="eyebrow">명칭 카드 30개 · 자유롭게 묶기</p><h1>끌어서, 하나로.</h1><p class="desktop-instruction">카드를 겹치면 새 묶음이 된다. 묶음 위에 놓으면 그 안으로 들어간다.</p><p class="mobile-instruction">오른쪽 <strong>점무늬</strong>를 잡고 다른 카드나 묶음에 놓는다.</p></div><div class="counter"><strong>${assigned.size}</strong><span> / 30</span><small>묶은 카드</small></div></section>
    <div class="board"><section class="pool-panel panel" aria-labelledby="pool-title"><div class="panel-heading" data-drop-pool><div><h2 id="pool-title">아직 묶지 않은 카드 <span>${pool.length}</span></h2><p>카드 위에 다른 카드를 놓으면 된다.</p></div><span class="panel-symbol" aria-hidden="true">▦</span></div><div class="panel-scroll pool-scroll" data-scroll="pool" data-drop-pool><div class="pool-grid">${pool.map(cardHTML).join('')}</div>${pool.length ? '' : '<div class="pool-empty"><span aria-hidden="true">✓</span><h3>카드 30개를 모두 묶었다.</h3><p>묶음에서 다시 끌어 옮길 수 있다.</p></div>'}</div></section>
    <section class="groups-panel panel" aria-labelledby="groups-title"><div class="panel-heading"><div><h2 id="groups-title">내가 만든 묶음 <span>${state.groups.length}</span></h2><p>묶음끼리도 끌어서 합칠 수 있다.</p></div><span class="panel-symbol" aria-hidden="true">▤</span></div><div class="panel-scroll groups-scroll" data-scroll="groups"><div class="group-grid">${state.groups.length ? state.groups.map((group, index) => `<section class="group tone-${index % 4}" data-node="group" data-id="${escape(group.id)}"><div class="group-header" data-group-header><span class="group-dot" aria-hidden="true"></span><label class="group-label"><span class="sr-only">${index + 1}번째 묶음 이름</span><input class="group-name" type="text" value="${escape(group.name)}" placeholder="묶음 이름" maxlength="60" autocomplete="off" data-rename="${escape(group.id)}" data-focus="name-${escape(group.id)}"></label><span class="group-count">${group.cardIds.length}</span>${grip('group', group.id, groupName(group))}<button type="button" class="dissolve" data-action="dissolve" data-id="${escape(group.id)}" aria-label="${escape(groupName(group))} 풀기">×</button></div><div class="group-cards">${group.cardIds.map(cardHTML).join('')}</div></section>`).join('') : '<div class="groups-empty"><div class="empty-art" aria-hidden="true"><i></i><span>＋</span><i></i></div><h3>두 카드를 겹쳐 첫 묶음을 만든다.</h3><p>카드끼리 합친 뒤 이름을 바꿀 수 있다.</p><span class="empty-note">묶음 개수는 자유이다.</span></div>'}</div></div></section></div>
    <footer class="workspace-footer"><span class="footer-guide"><span class="guide-dot"></span> 카드를 꺼내려면 미분류 영역으로 끈다.</span><button type="button" class="return-zone" data-drop-pool data-action="keyboard-return">↩ <span>카드로 꺼내기</span></button></footer>
    <p id="keyboard-help" class="sr-only">점무늬 버튼에서 Enter 또는 Space를 누르면 집어 든다. 합칠 대상의 점무늬에서 다시 누르면 놓는다. Escape로 취소할 수 있다. 카드로 꺼내기 버튼으로 묶음에서 꺼낼 수 있다.</p></main>`;
  for (const [key, top] of positions) { const el = document.querySelector(`[data-scroll="${key}"]`); if (el) el.scrollTop = top; }
  if (focused) document.querySelector(`[data-focus="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });
  if (keyboardSource) markSource(keyboardSource);
}

function destinationFor(element, source) {
  if (!element || !source) return null;
  const node = element.closest('[data-node]');
  if (node) {
    const kind = node.dataset.node;
    const id = node.dataset.id;
    if (kind === 'group') {
      if ((source.kind === 'group' && source.id === id) || (source.kind === 'card' && groupForCard(source.id)?.id === id)) return null;
      return { kind: 'group', id };
    }
    if (kind === 'card') {
      if (source.kind === 'card' && source.id === id) return null;
      const group = groupForCard(id);
      if (group) return destinationFor(document.querySelector(`.group[data-id="${CSS.escape(group.id)}"]`), source);
      return { kind: 'card', id };
    }
  }
  if (element.closest('.groups-panel') && source.kind === 'card') return { kind: 'new', id: 'new' };
  if (element.closest('[data-drop-pool]') && source.kind === 'card' && groupForCard(source.id)) return { kind: 'pool', id: 'pool' };
  return null;
}

function combine(source, destination) {
  if (!source || !destination) return;
  if (source.kind === 'card' && !cardForId(source.id)) return;
  if (source.kind === 'group' && !groupForId(source.id)) return;
  checkpoint();
  let text;
  if (source.kind === 'card') {
    const sourceLabel = cardForId(source.id).name;
    for (const group of state.groups) group.cardIds = group.cardIds.filter(id => id !== source.id);
    if (destination.kind === 'group') {
      const group = groupForId(destination.id);
      group.cardIds.push(source.id);
      text = `‘${groupName(group)}’에 카드를 넣었다.`;
    } else if (destination.kind === 'card') {
      state.groups.push({ id: crypto.randomUUID(), name: `묶음 ${state.nextGroup++}`, cardIds: [destination.id, source.id] });
      text = '카드 2개로 새 묶음을 만들었다.';
    } else if (destination.kind === 'new') {
      state.groups.push({ id: crypto.randomUUID(), name: `묶음 ${state.nextGroup++}`, cardIds: [source.id] });
      text = '카드로 새 묶음을 만들었다.';
    } else text = `‘${sourceLabel}’를 묶음에서 꺼냈다.`;
  } else if (destination.kind === 'group') {
    const from = groupForId(source.id);
    const into = groupForId(destination.id);
    into.cardIds.push(...from.cardIds);
    state.groups = state.groups.filter(group => group.id !== from.id);
    text = `두 묶음을 ‘${groupName(into)}’으로 합쳤다.`;
  } else if (destination.kind === 'card') {
    groupForId(source.id).cardIds.push(destination.id);
    text = '묶음에 카드를 더했다.';
  }
  state.groups = state.groups.filter(group => group.cardIds.length);
  if (!valid(state)) { state = JSON.parse(history.pop()); throw new Error('카드 보존 확인 실패'); }
  save(); render(); notify(text);
}

function nodesFor(source) {
  return [...document.querySelectorAll(`[data-node="${source.kind}"][data-id="${CSS.escape(source.id)}"]`)];
}
function markSource(source) { nodesFor(source).forEach(el => el.classList.add('picked-source')); }
function clearMarks() { document.querySelectorAll('.picked-source,.drop-target,.drop-pool-active').forEach(el => el.classList.remove('picked-source', 'drop-target', 'drop-pool-active')); }
function targetLabel(destination) {
  if (!destination) return '합칠 카드나 묶음 위에 놓는다.';
  if (destination.kind === 'card') return '놓으면 새 묶음이 된다.';
  if (destination.kind === 'group') return `‘${groupName(groupForId(destination.id))}’에 합친다.`;
  if (destination.kind === 'new') return '빈 곳에 놓아 새 묶음을 만든다.';
  return '놓으면 묶음에서 꺼낸다.';
}
function updateTarget() {
  if (!pointer?.active) return;
  document.querySelectorAll('.drop-target,.drop-pool-active').forEach(el => el.classList.remove('drop-target', 'drop-pool-active'));
  const element = document.elementFromPoint(pointer.x, pointer.y);
  target = destinationFor(element, pointer.source);
  if (target?.kind === 'pool') element?.closest('[data-drop-pool]')?.classList.add('drop-pool-active');
  else if (target?.kind === 'new') document.querySelector('.groups-panel')?.classList.add('drop-target');
  else if (target) document.querySelectorAll(`[data-node="${target.kind}"][data-id="${CSS.escape(target.id)}"]`).forEach(el => el.classList.add('drop-target'));
  dragHint.textContent = targetLabel(target);
  dragHint.classList.toggle('valid', !!target);
}

function positionGhost() {
  if (!pointer) return;
  const width = ghost.offsetWidth || 170;
  const x = Math.max(8, Math.min(innerWidth - width - 8, pointer.x - width / 2));
  const y = Math.max(8, Math.min(innerHeight - 60, pointer.y - 72));
  ghost.style.transform = `translate3d(${x}px,${y}px,0)`;
}

function startDrag() {
  pointer.active = true;
  keyboardSource = null;
  clearMarks(); markSource(pointer.source);
  document.body.classList.add('dragging');
  ghost.innerHTML = `<span class="ghost-label">${escape(sourceName(pointer.source))}</span><span class="ghost-mark" aria-hidden="true">⠿</span>${pointer.source.kind === 'group' ? `<small>카드 ${groupForId(pointer.source.id).cardIds.length}개</small>` : ''}`;
  ghost.classList.add('visible'); dragHint.classList.add('visible');
  navigator.vibrate?.(12);
  positionGhost(); updateTarget(); autoScroll();
}

function autoScroll() {
  if (!pointer?.active) return;
  const element = document.elementFromPoint(pointer.x, pointer.y);
  const scroll = element?.closest('[data-scroll]');
  if (scroll) {
    const rect = scroll.getBoundingClientRect();
    const edge = Math.min(48, rect.height / 4);
    let delta = 0;
    if (pointer.y < rect.top + edge) delta = -Math.ceil((rect.top + edge - pointer.y) / 5);
    else if (pointer.y > rect.bottom - edge) delta = Math.ceil((pointer.y - rect.bottom + edge) / 5);
    if (delta) { scroll.scrollTop += delta; updateTarget(); }
  }
  frame = requestAnimationFrame(autoScroll);
}

function cleanupPointer() {
  if (frame) cancelAnimationFrame(frame);
  frame = null;
  if (pointer?.capture?.hasPointerCapture?.(pointer.pointerId)) pointer.capture.releasePointerCapture(pointer.pointerId);
  pointer = null; target = null;
  ghost.classList.remove('visible'); dragHint.classList.remove('visible', 'valid');
  document.body.classList.remove('dragging'); clearMarks();
}

document.addEventListener('pointerdown', event => {
  if (event.button !== 0 || pointer || confirmation.open) return;
  const handle = event.target.closest('[data-handle]');
  let node;
  if (handle) node = { kind: handle.dataset.kind, id: handle.dataset.id };
  else if (event.pointerType === 'mouse' && !event.target.closest('input,button,a')) {
    const card = event.target.closest('.card');
    const header = event.target.closest('[data-group-header]');
    if (card) node = { kind: 'card', id: card.dataset.id };
    else if (header) node = { kind: 'group', id: header.closest('.group').dataset.id };
  }
  if (!node) return;
  if (handle) handle.focus({ preventScroll: true });
  const capture = handle || event.target.closest('[data-node]');
  pointer = { source: node, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, active: false, capture };
  capture.setPointerCapture(event.pointerId);
  event.preventDefault();
});

document.addEventListener('pointermove', event => {
  if (!pointer || pointer.pointerId !== event.pointerId) return;
  pointer.x = event.clientX; pointer.y = event.clientY;
  if (!pointer.active && Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY) >= 5) startDrag();
  if (pointer.active) { event.preventDefault(); positionGhost(); updateTarget(); }
}, { passive: false });

document.addEventListener('pointerup', event => {
  if (!pointer || pointer.pointerId !== event.pointerId) return;
  const source = pointer.source;
  const active = pointer.active;
  if (active) { pointer.x = event.clientX; pointer.y = event.clientY; updateTarget(); }
  const drop = target;
  cleanupPointer();
  if (active) {
    ignoreClicksUntil = Date.now() + 450;
    if (drop) combine(source, drop); else notify('카드를 합칠 위치에 놓으면 된다.');
  }
});

document.addEventListener('pointercancel', event => { if (pointer?.pointerId === event.pointerId) cleanupPointer(); });
window.addEventListener('blur', () => { if (pointer) cleanupPointer(); });
window.addEventListener('resize', () => { if (pointer?.active) { positionGhost(); updateTarget(); } });

app.addEventListener('input', event => {
  const group = groupForId(event.target.dataset.rename);
  if (group) { group.name = event.target.value; save(); }
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    if (pointer) cleanupPointer();
    if (keyboardSource) { keyboardSource = null; clearMarks(); announce('이동을 취소했다.'); }
  }
  if (event.target.dataset.rename && event.key === 'Enter') { event.preventDefault(); event.target.blur(); }
});

function ask(title, text, operation) {
  confirmOperation = operation;
  confirmation.innerHTML = `<h2 id="confirmation-title">${escape(title)}</h2><p>${escape(text)}</p><div class="confirmation-actions"><button type="button" class="reset-button" data-action="cancel" autofocus>취소</button><button type="button" class="confirm-button" data-action="confirm">${operation.kind === 'reset' ? '처음부터' : '묶음 풀기'}</button></div>`;
  confirmation.showModal();
}

document.addEventListener('click', event => {
  if (Date.now() < ignoreClicksUntil && event.detail > 0 && event.target.closest('[data-handle]')) { event.preventDefault(); return; }
  const handle = event.target.closest('[data-handle]');
  if (handle && event.detail === 0) {
    const chosen = { kind: handle.dataset.kind, id: handle.dataset.id };
    if (!keyboardSource) { keyboardSource = chosen; clearMarks(); markSource(chosen); announce('집어 들었다. 합칠 대상의 점무늬에서 Enter를 누르면 된다.'); }
    else {
      const destination = destinationFor(handle, keyboardSource);
      const source = keyboardSource; keyboardSource = null; clearMarks();
      if (destination) combine(source, destination);
    }
    return;
  }
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const { action, id } = button.dataset;
  if (action === 'undo' && history.length) {
    state = JSON.parse(history.pop()); keyboardSource = null; save(); render(); notify('이전 분류로 되돌렸다.');
  } else if (action === 'reset') ask('처음부터 다시 묶을까?', '현재 묶음을 풀고 카드 30개를 다시 펼친다.', { kind: 'reset' });
  else if (action === 'dissolve') ask('이 묶음을 풀까?', '포함된 카드가 미분류 영역으로 돌아간다.', { kind: 'dissolve', id });
  else if (action === 'cancel') confirmation.close();
  else if (action === 'confirm') {
    confirmation.close(); checkpoint(); keyboardSource = null;
    if (confirmOperation.kind === 'reset') state = fresh();
    else state.groups = state.groups.filter(group => group.id !== confirmOperation.id);
    save(); render();
  } else if (action === 'keyboard-return' && keyboardSource?.kind === 'card') {
    const source = keyboardSource; keyboardSource = null; clearMarks();
    if (groupForCard(source.id)) combine(source, { kind: 'pool', id: 'pool' });
  }
});

save(); render();
