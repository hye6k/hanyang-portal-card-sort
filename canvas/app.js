import { cardNames } from '../test/cards.js';

const CARD_W = 144, CARD_H = 70, GAP = 24;
const catalog = cardNames.map((name, i) => ({ id: `card-${i + 1}`, name }));
const viewport = document.querySelector('#viewport');
const world = document.querySelector('#world');
const cardsElement = document.querySelector('#cards');
const outlines = document.querySelector('#outlines');
const reviewDialog = document.querySelector('#review');
const hint = document.querySelector('#hint');
const storageKey = 'hyu-spatial-card-sort-v1';
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const cardName = id => catalog.find(card => card.id === id)?.name || '';
const copy = value => JSON.parse(JSON.stringify(value));
function initial() {
  const cols = innerWidth <= 700 ? 2 : 5;
  const order = [...catalog];
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const positions = {};
  order.forEach((card, index) => { positions[card.id] = { x: (index % cols) * 184, y: Math.floor(index / cols) * 112, z: index + 1 }; });
  const width = cols * CARD_W + (cols - 1) * 40;
  const scale = Math.min(1, (innerWidth - 24) / width);
  return { positions, view: { x: Math.max(12, (innerWidth - width * scale) / 2), y: 20, scale }, review: null, confirmed: false };
}
function valid(value) {
  return value && catalog.every(card => {
    const p = value.positions?.[card.id];
    return p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
  }) && value.view && ['x', 'y', 'scale'].every(k => Number.isFinite(value.view[k])) && value.view.scale >= 0.01 && value.view.scale <= 2.5;
}
let state;
try { const value = JSON.parse(localStorage.getItem(storageKey) || 'null'); if (valid(value)) state = value; } catch {}
state ||= initial();
const pointers = new Map();
let gesture = null;
let animation = null;
let history = [];
let selectedId = null;
let toastTimer;
let lastTap = null;

function save() { try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch {} }
function announce(text) { document.querySelector('#announcer').textContent = text; }
function notify(text) { const el = document.querySelector('#toast'); clearTimeout(toastTimer); el.textContent = text; el.classList.add('visible'); toastTimer = setTimeout(() => el.classList.remove('visible'), 2600); announce(text); }
function remember(snapshot) { history.push(snapshot); if (history.length > 20) history.shift(); updateControls(); }
function invalidate() { state.review = null; state.confirmed = false; drawOutlines(); updateControls(); }
function updateControls() {
  document.querySelector('#zoom').textContent = `${Math.round(state.view.scale * 100)}%`;
  document.querySelector('[data-action=undo]').disabled = !history.length;
  document.querySelector('[data-action=review]').textContent = state.confirmed ? '묶음 보기' : '묶음 확인';
}

function renderCards() {
  cardsElement.innerHTML = catalog.map(card => `<div class="card" tabindex="0" role="button" aria-label="${escape(card.name)}. 끌거나 방향키로 이동" data-id="${card.id}"><span>${escape(card.name)}</span></div>`).join('');
  paint();
}
function paint() {
  world.style.transform = `translate3d(${state.view.x}px,${state.view.y}px,0) scale(${state.view.scale})`;
  const spacing = Math.max(6, 24 * state.view.scale);
  viewport.style.backgroundSize = `${spacing}px ${spacing}px`;
  viewport.style.backgroundPosition = `${state.view.x}px ${state.view.y}px`;
  for (const card of catalog) {
    const el = cardsElement.querySelector(`[data-id="${card.id}"]`);
    const p = state.positions[card.id];
    el.style.transform = `translate3d(${p.x}px,${p.y}px,0)`;
    el.style.zIndex = p.z;
    el.classList.toggle('selected', card.id === selectedId);
    el.classList.toggle('moving', gesture?.type === 'card' && gesture.id === card.id && gesture.moved);
  }
  updateControls();
}

function drawOutlines() {
  if (!state.confirmed || !state.review) { outlines.innerHTML = ''; return; }
  outlines.innerHTML = state.review.groups.map((group, index) => {
    const positions = group.cardIds.map(id => state.positions[id]);
    const x = Math.min(...positions.map(p => p.x)) - 12;
    const y = Math.min(...positions.map(p => p.y)) - 30;
    const right = Math.max(...positions.map(p => p.x + CARD_W)) + 12;
    const bottom = Math.max(...positions.map(p => p.y + CARD_H)) + 12;
    return `<div class="group-outline tone-${index % 4}" style="left:${x}px;top:${y}px;width:${right - x}px;height:${bottom - y}px"><span>${escape(group.name)}</span></div>`;
  }).join('');
}

function zoomAt(x, y, scale) {
  const next = clamp(scale, 0.01, 2.5);
  const wx = (x - state.view.x) / state.view.scale;
  const wy = (y - state.view.y) / state.view.scale;
  state.view = { x: x - wx * next, y: y - wy * next, scale: next };
  paint();
}
function fitAll() {
  const positions = Object.values(state.positions);
  const left = Math.min(...positions.map(p => p.x));
  const top = Math.min(...positions.map(p => p.y));
  const width = Math.max(...positions.map(p => p.x + CARD_W)) - left;
  const height = Math.max(...positions.map(p => p.y + CARD_H)) - top;
  const scale = clamp(Math.min((innerWidth - 32) / width, (innerHeight - 106) / height), 0.01, 1.5);
  state.view = { scale, x: (innerWidth - width * scale) / 2 - left * scale, y: 20 - top * scale };
  paint(); save();
}
function focusCard(id) {
  const p = state.positions[id];
  const scale = Math.max(1.15, state.view.scale);
  state.view = { scale, x: innerWidth / 2 - (p.x + CARD_W / 2) * scale, y: (innerHeight - 80) / 2 - (p.y + CARD_H / 2) * scale };
  paint(); save();
}

function updateCard(point) {
  const p = state.positions[gesture.id];
  p.x = clamp((point.x - state.view.x) / state.view.scale - gesture.offset.x, -10000, 10000);
  p.y = clamp((point.y - state.view.y) / state.view.scale - gesture.offset.y, -10000, 10000);
}
function edgePan() {
  if (gesture?.type !== 'card' || !gesture.moved) return;
  const point = pointers.values().next().value;
  if (!point) return;
  const edge = 30;
  const speed = value => clamp(value / 5, -9, 9);
  if (point.x < edge) state.view.x += speed(edge - point.x);
  else if (point.x > innerWidth - edge) state.view.x -= speed(point.x - innerWidth + edge);
  if (point.y < edge) state.view.y += speed(edge - point.y);
  else if (point.y > innerHeight - 72) state.view.y -= speed(point.y - innerHeight + 72);
  updateCard(point); paint();
  animation = requestAnimationFrame(edgePan);
}
function stopAnimation() { if (animation) cancelAnimationFrame(animation); animation = null; }

viewport.addEventListener('pointerdown', event => {
  if (event.button !== 0 || reviewDialog.open || pointers.size >= 2) return;
  hint.classList.add('hidden');
  event.preventDefault();
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  viewport.setPointerCapture(event.pointerId);
  if (pointers.size === 2) {
    if (gesture?.type === 'card') state.positions[gesture.id] = gesture.original;
    stopAnimation();
    const [a, b] = [...pointers.values()];
    const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    gesture = { type: 'pinch', distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), scale: state.view.scale, anchor: { x: (center.x - state.view.x) / state.view.scale, y: (center.y - state.view.y) / state.view.scale } };
    paint(); return;
  }
  const id = event.target.closest('.card')?.dataset.id;
  const start = { x: event.clientX, y: event.clientY };
  if (id) {
    const original = { ...state.positions[id] };
    selectedId = id;
    gesture = { type: 'card', id, start, original, snapshot: copy(state.positions), moved: false, offset: { x: (start.x - state.view.x) / state.view.scale - original.x, y: (start.y - state.view.y) / state.view.scale - original.y } };
  } else { selectedId = null; gesture = { type: 'pan', start, view: { ...state.view } }; }
  paint();
});

viewport.addEventListener('pointermove', event => {
  if (!pointers.has(event.pointerId) || !gesture) return;
  event.preventDefault();
  const point = { x: event.clientX, y: event.clientY };
  pointers.set(event.pointerId, point);
  if (gesture.type === 'pinch' && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const scale = clamp(gesture.scale * Math.hypot(a.x - b.x, a.y - b.y) / gesture.distance, 0.01, 2.5);
    state.view = { scale, x: center.x - gesture.anchor.x * scale, y: center.y - gesture.anchor.y * scale };
  } else if (gesture.type === 'pan') {
    state.view.x = gesture.view.x + point.x - gesture.start.x;
    state.view.y = gesture.view.y + point.y - gesture.start.y;
  } else if (gesture.type === 'card') {
    if (!gesture.moved && Math.hypot(point.x - gesture.start.x, point.y - gesture.start.y) >= 4) {
      gesture.moved = true;
      state.positions[gesture.id].z = Math.max(...Object.values(state.positions).map(p => p.z)) + 1;
      animation = requestAnimationFrame(edgePan);
    }
    if (gesture.moved) updateCard(point);
  }
  paint();
}, { passive: false });

function finishPointer(event, cancelled = false) {
  if (!pointers.has(event.pointerId)) return;
  pointers.delete(event.pointerId);
  if (gesture?.type === 'pinch' && pointers.size === 1) {
    const start = pointers.values().next().value;
    gesture = { type: 'pan', start: { ...start }, view: { ...state.view } };
    save(); return;
  }
  if (!pointers.size) {
    stopAnimation();
    if (gesture?.type === 'card') {
      if (cancelled) state.positions[gesture.id] = gesture.original;
      else if (gesture.moved) { remember(gesture.snapshot); invalidate(); }
      else {
        if (lastTap?.id === gesture.id && Date.now() - lastTap.time < 330) focusCard(gesture.id);
        lastTap = { id: gesture.id, time: Date.now() };
      }
    }
    gesture = null; paint(); save();
  }
}
viewport.addEventListener('pointerup', event => finishPointer(event));
viewport.addEventListener('pointercancel', event => finishPointer(event, true));
window.addEventListener('blur', () => {
  if (gesture?.type === 'card') state.positions[gesture.id] = gesture.original;
  pointers.clear(); gesture = null; stopAnimation(); paint(); save();
});
viewport.addEventListener('wheel', event => {
  event.preventDefault(); hint.classList.add('hidden');
  if (event.ctrlKey || event.metaKey) zoomAt(event.clientX, event.clientY, state.view.scale * Math.exp(-event.deltaY * 0.008));
  else { state.view.x -= event.deltaX; state.view.y -= event.deltaY; paint(); }
  save();
}, { passive: false });
viewport.addEventListener('keydown', event => {
  const id = event.target.closest('.card')?.dataset.id;
  const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (!id || !directions[event.key]) return;
  event.preventDefault(); remember(copy(state.positions));
  const [dx, dy] = directions[event.key];
  state.positions[id].x += dx * (event.shiftKey ? 40 : 12);
  state.positions[id].y += dy * (event.shiftKey ? 40 : 12);
  invalidate(); paint(); save(); announce(`${cardName(id)} 위치 이동`);
});
viewport.addEventListener('focusin', event => {
  const id = event.target.closest('.card')?.dataset.id;
  if (!id) return;
  viewport.scrollLeft = 0; viewport.scrollTop = 0;
  const rect = event.target.getBoundingClientRect();
  if (rect.left < 8 || rect.top < 8 || rect.right > innerWidth - 8 || rect.bottom > innerHeight - 75) focusCard(id);
});

function inferGroups() {
  const parents = catalog.map((_, i) => i);
  function find(i) { while (parents[i] !== i) { parents[i] = parents[parents[i]]; i = parents[i]; } return i; }
  for (let i = 0; i < catalog.length; i++) for (let j = i + 1; j < catalog.length; j++) {
    const a = state.positions[catalog[i].id], b = state.positions[catalog[j].id];
    const dx = Math.max(0, a.x - b.x - CARD_W, b.x - a.x - CARD_W);
    const dy = Math.max(0, a.y - b.y - CARD_H, b.y - a.y - CARD_H);
    if (Math.hypot(dx, dy) <= GAP) parents[find(i)] = find(j);
  }
  const clusters = new Map();
  catalog.forEach((card, i) => { const root = find(i); if (!clusters.has(root)) clusters.set(root, []); clusters.get(root).push(card.id); });
  const groups = [], singles = [];
  for (const ids of clusters.values()) {
    if (ids.length === 1) singles.push(ids[0]);
    else groups.push({ id: crypto.randomUUID(), name: `묶음 ${groups.length + 1}`, cardIds: ids });
  }
  return { groups, singles, nextGroup: groups.length + 1, inferred: { groups: copy(groups), singles: [...singles] } };
}

function moveSelect(id, current) {
  return `<select data-move-card="${id}" aria-label="${escape(cardName(id))} 묶음 변경"><option value="">옮기기</option>${state.review.groups.filter(g => g.id !== current).map(g => `<option value="${g.id}">${escape(g.name)}</option>`).join('')}${current ? '<option value="single">따로 두기</option>' : ''}<option value="new">새 묶음</option></select>`;
}
function reviewRows(ids, current) { return ids.map(id => `<div class="review-card"><span>${escape(cardName(id))}</span>${moveSelect(id, current)}</div>`).join(''); }
function renderReview() {
  const result = state.review;
  reviewDialog.innerHTML = `<div class="review-heading"><div><p class="eyebrow">${state.confirmed ? '확정한 분류' : '배치를 바탕으로 한 제안'}</p><h1>이렇게 묶으면 맞는가?</h1><p>가까이 놓인 카드끼리 제안했다. 다르면 옮기거나 배치로 돌아가 수정할 수 있다.</p></div><button type="button" class="close-review" data-action="back" aria-label="배치로 돌아가기">×</button></div><div class="review-scroll"><p class="review-count">묶음 ${result.groups.length}개 <span>·</span> 따로 둔 카드 ${result.singles.length}개</p><div class="review-groups">${result.groups.map((g, i) => `<section class="review-group tone-${i % 4}"><div class="review-group-heading"><label><span class="sr-only">묶음 이름</span><input type="text" data-group-name="${g.id}" value="${escape(g.name)}" maxlength="60" aria-label="${i + 1}번째 묶음 이름"></label><span>${g.cardIds.length}개</span><button type="button" data-action="split" data-id="${g.id}">풀기</button></div>${reviewRows(g.cardIds, g.id)}</section>`).join('')}</div>${result.singles.length ? `<section class="single-section"><h2>따로 놓인 카드</h2><p>혼자 두려는 카드라면 그대로 확정해도 된다.</p>${reviewRows(result.singles, null)}</section>` : ''}</div><div class="review-actions"><button type="button" class="back-button" data-action="back">배치로 돌아가기</button><button type="button" class="confirm-button" data-action="confirm">${state.confirmed ? '확인 완료' : '이 분류로 확정'}</button></div>`;
}
function showReview() {
  if (!state.review) state.review = inferGroups();
  renderReview(); reviewDialog.showModal(); save();
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  if (action === 'zoom-in' || action === 'zoom-out') { zoomAt(innerWidth / 2, (innerHeight - 70) / 2, state.view.scale * (action === 'zoom-in' ? 1.25 : 0.8)); save(); }
  else if (action === 'fit') fitAll();
  else if (action === 'undo' && history.length) { state.positions = history.pop(); invalidate(); paint(); save(); }
  else if (action === 'review') showReview();
  else if (action === 'back') { reviewDialog.close(); updateControls(); save(); }
  else if (action === 'split') {
    const group = state.review.groups.find(g => g.id === button.dataset.id);
    state.review.singles.push(...group.cardIds);
    state.review.groups = state.review.groups.filter(g => g.id !== group.id);
    state.confirmed = false; save(); renderReview(); drawOutlines();
  } else if (action === 'confirm') {
    state.review.groups.forEach((g, i) => { g.name = g.name.trim() || `묶음 ${i + 1}`; });
    const ids = [...state.review.singles, ...state.review.groups.flatMap(g => g.cardIds)];
    if (ids.length !== 30 || new Set(ids).size !== 30) { notify('카드 분류를 다시 확인해야 한다.'); return; }
    state.confirmed = true; state.confirmedAt = new Date().toISOString();
    reviewDialog.close(); drawOutlines(); updateControls(); save(); notify('확인한 묶음으로 분류를 확정했다.');
  }
});
reviewDialog.addEventListener('input', event => {
  const group = state.review.groups.find(g => g.id === event.target.dataset.groupName);
  if (group) { group.name = event.target.value; state.confirmed = false; drawOutlines(); updateControls(); save(); }
});
reviewDialog.addEventListener('change', event => {
  const id = event.target.dataset.moveCard, destination = event.target.value;
  if (!id || !destination) return;
  state.review.singles = state.review.singles.filter(value => value !== id);
  for (const group of state.review.groups) group.cardIds = group.cardIds.filter(value => value !== id);
  if (destination === 'single') state.review.singles.push(id);
  else if (destination === 'new') {
    state.review.nextGroup ||= state.review.groups.length + 1;
    state.review.groups.push({ id: crypto.randomUUID(), name: `묶음 ${state.review.nextGroup++}`, cardIds: [id] });
  }
  else state.review.groups.find(g => g.id === destination).cardIds.push(id);
  state.review.groups = state.review.groups.filter(g => g.cardIds.length);
  state.confirmed = false; save(); renderReview(); drawOutlines();
});
window.addEventListener('resize', paint);
setTimeout(() => hint.classList.add('hidden'), 6500);
renderCards(); drawOutlines(); save();
