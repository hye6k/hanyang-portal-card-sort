import { cardNames } from '../test/cards.js';

const CARD_W = 144, CARD_H = 70, GAP = 24;
const CARD_CLEARANCE = 8;
const COLLISION_RADIUS = 16;
// Whole groups stay farther apart than both proximity links and outline padding.
const GROUP_CLEARANCE = 44;
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
function overviewView(positions) {
  const points = Object.values(positions);
  const left = Math.min(...points.map(p => p.x)), top = Math.min(...points.map(p => p.y));
  const width = Math.max(...points.map(p => p.x + CARD_W)) - left;
  const height = Math.max(...points.map(p => p.y + CARD_H)) - top;
  const availableHeight = Math.max(1, innerHeight - 84);
  const scale = clamp(Math.min((innerWidth - 32) / width, (availableHeight - 32) / height), 0.01, 1.5);
  return { scale, x: (innerWidth - width * scale) / 2 - left * scale, y: (availableHeight - height * scale) / 2 - top * scale };
}
function initial(existingOrder) {
  const cols = 5, rows = Math.ceil(catalog.length / cols);
  const stepX = CARD_W + 48;
  const side = (cols - 1) * stepX + CARD_W;
  const stepY = rows > 1 ? (side - CARD_H) / (rows - 1) : 0;
  const order = existingOrder || [...catalog];
  if (!existingOrder) for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const positions = {};
  order.forEach((card, index) => { positions[card.id] = { x: (index % cols) * stepX, y: Math.floor(index / cols) * stepY, z: index + 1 }; });
  return { positions, view: overviewView(positions), review: null, confirmed: false, layoutVersion: 'square-v1' };
}
function isUntouchedOldGrid(value) {
  if (value.layoutVersion || value.review || value.confirmed) return false;
  const points = Object.values(value.positions).sort((a, b) => a.y - b.y || a.x - b.x);
  return [2, 5].some(cols => points.every((p, i) => Math.abs(p.x - (i % cols) * 184) < .01 && Math.abs(p.y - Math.floor(i / cols) * 112) < .01));
}
function valid(value) {
  return value && catalog.every(card => {
    const p = value.positions?.[card.id];
    return p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
  }) && value.view && ['x', 'y', 'scale'].every(k => Number.isFinite(value.view[k])) && value.view.scale >= 0.01 && value.view.scale <= 2.5;
}
let state;
try { const value = JSON.parse(localStorage.getItem(storageKey) || 'null'); if (valid(value)) state = value; } catch {}
if (state && isUntouchedOldGrid(state)) {
  const order = [...catalog].sort((a, b) => state.positions[a.id].y - state.positions[b.id].y || state.positions[a.id].x - state.positions[b.id].x);
  state = initial(order);
}
state ||= initial();
state.view = overviewView(state.positions);
const pointers = new Map();
let gesture = null;
let animation = null;
let history = [];
let selectedId = null;
let toastTimer;
let lastTap = null;
let outlineMarkup = '';
let previewGroups = [];
let holdTimer;
const isCardGesture = () => gesture?.type === 'card' || gesture?.type === 'group';
function cancelHold() { clearTimeout(holdTimer); holdTimer = null; }
function restoreDrag() {
  if (isCardGesture()) state.positions = copy(gesture.snapshot);
}
function armGroupHold() {
  const pending = gesture;
  holdTimer = setTimeout(() => {
    if (gesture !== pending || pending.moved || pointers.size !== 1) return;
    const confirmedGroup = state.confirmed && state.review?.groups.find(group => group.cardIds.includes(pending.id));
    const ids = confirmedGroup?.cardIds || spatialClusters().find(ids => ids.includes(pending.id));
    if (!ids || ids.length < 2) return;
    pending.type = 'group'; pending.ids = [...ids]; pending.groupName = confirmedGroup?.name;
    pending.others = movementGroups(ids);
    lastTap = null;
    announce(`${ids.length}개 묶음 선택`);
    paint();
  }, 500);
}

function save() { try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch {} }
function announce(text) { document.querySelector('#announcer').textContent = text; }
function notify(text) { const el = document.querySelector('#toast'); clearTimeout(toastTimer); el.textContent = text; el.classList.add('visible'); toastTimer = setTimeout(() => el.classList.remove('visible'), 2600); announce(text); }
function remember(snapshot, preserveClassification = false) {
  history.push({ positions: snapshot, classification: preserveClassification ? { review: copy(state.review), confirmed: state.confirmed, confirmedAt: state.confirmedAt } : null });
  if (history.length > 20) history.shift();
  updateControls();
}
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
  world.style.setProperty('--group-stroke', `${2 / state.view.scale}px`);
  world.style.setProperty('--confirmed-stroke', `${2.5 / state.view.scale}px`);
  world.style.setProperty('--held-stroke', `${3.2 / state.view.scale}px`);
  const spacing = Math.max(6, 24 * state.view.scale);
  viewport.style.backgroundSize = `${spacing}px ${spacing}px`;
  viewport.style.backgroundPosition = `${state.view.x}px ${state.view.y}px`;
  for (const card of catalog) {
    const el = cardsElement.querySelector(`[data-id="${card.id}"]`);
    const p = state.positions[card.id];
    el.style.transform = `translate3d(${p.x}px,${p.y}px,0)`;
    el.style.zIndex = p.z;
    el.classList.toggle('selected', card.id === selectedId);
    const inGroup = gesture?.type === 'group' && gesture.ids.includes(card.id);
    el.classList.toggle('moving', isCardGesture() && gesture.moved && (gesture.id === card.id || inGroup));
    el.classList.toggle('group-held', inGroup);
    el.classList.toggle('pushed', isCardGesture() && gesture.pushed?.has(card.id));
  }
  drawOutlines();
  updateControls();
}

function drawOutlines() {
  const confirmed = state.confirmed && state.review && !(gesture?.type === 'card' && gesture.moved);
  let groups = confirmed ? state.review.groups : spatialClusters(gesture?.type === 'group' ? gesture.ids : []).filter(ids => ids.length > 1).map(cardIds => ({ cardIds }));
  if (gesture?.type === 'group') {
    groups = gesture.others.filter(group => group.cardIds.length > 1).map(group => ({ ...group }));
    groups.push({ cardIds: gesture.ids, name: gesture.groupName, held: true });
  }
  if (!confirmed) {
    // Keep each area's colour while cards enter, leave, or reorder the clusters.
    const available = new Set(previewGroups);
    const usedTones = new Set();
    for (const group of [...groups].sort((a, b) => b.cardIds.length - a.cardIds.length)) {
      let match, shared = 0;
      for (const previous of available) {
        const count = group.cardIds.filter(id => previous.cardIds.includes(id)).length;
        if (count > shared) { match = previous; shared = count; }
      }
      if (match) { group.tone = match.tone; available.delete(match); }
      else group.tone = [0, 1, 2, 3].find(tone => !usedTones.has(tone)) ?? groups.indexOf(group) % 4;
      usedTones.add(group.tone);
    }
    previewGroups = groups;
  }
  const markup = groups.map((group, index) => {
    const positions = group.cardIds.map(id => state.positions[id]);
    const x = Math.min(...positions.map(p => p.x)) - 16;
    const y = Math.min(...positions.map(p => p.y)) - 24;
    const right = Math.max(...positions.map(p => p.x + CARD_W)) + 16;
    const bottom = Math.max(...positions.map(p => p.y + CARD_H)) + 16;
    const anchor = [...positions].sort((a, b) => a.y - b.y || a.x - b.x)[0];
    const label = confirmed ? group.name : null;
    const labelMarkup = label ? `<span style="left:${anchor.x - x + 4}px;top:${anchor.y - y - 21}px">${escape(label)}</span>` : '';
    const width = right - x, height = bottom - y;
    return `<div aria-hidden="true" class="group-outline ${confirmed ? 'confirmed' : 'preview'} ${group.held ? 'group-held' : ''} tone-${group.tone ?? index % 4}" data-cards="${group.cardIds.join(',')}" style="left:${x}px;top:${y}px;width:${width}px;height:${height}px"><svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><path fill-rule="evenodd" d="${roundedContour(positions, x, y)}"/></svg>${labelMarkup}</div>`;
  }).join('');
  if (markup !== outlineMarkup) { outlines.innerHTML = markup; outlineMarkup = markup; }
}

function roundedContour(positions, originX, originY) {
  // Trace the union of padded card rectangles, retaining concave gaps and holes.
  // Coordinate compression keeps the work bounded by card count, not world size.
  const rectangles = positions.map(p => ({ left: p.x - 16, right: p.x + CARD_W + 16, top: p.y - 24, bottom: p.y + CARD_H + 16 }));
  const xs = [...new Set(rectangles.flatMap(r => [r.left, r.right]))].sort((a, b) => a - b);
  const ys = [...new Set(rectangles.flatMap(r => [r.top, r.bottom]))].sort((a, b) => a - b);
  const xi = new Map(xs.map((x, i) => [x, i])), yi = new Map(ys.map((y, i) => [y, i]));
  const cols = xs.length - 1, rows = ys.length - 1;
  const cells = new Uint8Array(cols * rows);
  for (const r of rectangles) for (let j = yi.get(r.top); j < yi.get(r.bottom); j++) {
    for (let i = xi.get(r.left); i < xi.get(r.right); i++) cells[j * cols + i] = 1;
  }
  const occupied = (i, j) => i >= 0 && j >= 0 && i < cols && j < rows && cells[j * cols + i];
  const edges = [], starts = new Map();
  function edge(ax, ay, bx, by, direction) {
    const value = { ax, ay, bx, by, direction, used: false };
    edges.push(value);
    const key = `${ax},${ay}`;
    if (!starts.has(key)) starts.set(key, []);
    starts.get(key).push(value);
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) if (occupied(i, j)) {
    if (!occupied(i, j - 1)) edge(i, j, i + 1, j, 0);
    if (!occupied(i + 1, j)) edge(i + 1, j, i + 1, j + 1, 1);
    if (!occupied(i, j + 1)) edge(i + 1, j + 1, i, j + 1, 2);
    if (!occupied(i - 1, j)) edge(i, j + 1, i, j, 3);
  }
  const loops = [];
  for (const first of edges) {
    if (first.used) continue;
    const points = [];
    let current = first;
    while (current && !current.used) {
      current.used = true;
      points.push({ x: xs[current.ax] - originX, y: ys[current.ay] - originY });
      if (current.bx === first.ax && current.by === first.ay) break;
      const next = (starts.get(`${current.bx},${current.by}`) || []).filter(e => !e.used);
      const priority = e => [1, 0, 3, 2][(e.direction - current.direction + 4) % 4];
      current = next.sort((a, b) => priority(a) - priority(b))[0];
    }
    const corners = points.filter((p, i) => {
      const prev = points[(i + points.length - 1) % points.length], next = points[(i + 1) % points.length];
      return (p.x - prev.x) * (next.y - p.y) !== (p.y - prev.y) * (next.x - p.x);
    });
    if (corners.length >= 3) loops.push(corners);
  }
  const n = value => Math.round(value * 100) / 100;
  return loops.map(points => {
    const curves = points.map((p, i) => {
      const prev = points[(i + points.length - 1) % points.length], next = points[(i + 1) % points.length];
      const incoming = Math.hypot(p.x - prev.x, p.y - prev.y), outgoing = Math.hypot(next.x - p.x, next.y - p.y);
      const radius = Math.min(18, incoming / 2, outgoing / 2);
      return { p, start: { x: p.x + (prev.x - p.x) / incoming * radius, y: p.y + (prev.y - p.y) / incoming * radius }, end: { x: p.x + (next.x - p.x) / outgoing * radius, y: p.y + (next.y - p.y) / outgoing * radius } };
    });
    return curves.map((c, i) => `${i ? 'L' : 'M'}${n(c.start.x)},${n(c.start.y)} Q${n(c.p.x)},${n(c.p.y)} ${n(c.end.x)},${n(c.end.y)}`).join(' ') + ' Z';
  }).join(' ');
}

function zoomAt(x, y, scale) {
  const next = clamp(scale, 0.01, 2.5);
  const wx = (x - state.view.x) / state.view.scale;
  const wy = (y - state.view.y) / state.view.scale;
  state.view = { x: x - wx * next, y: y - wy * next, scale: next };
  paint();
}
function fitAll() {
  state.view = overviewView(state.positions);
  paint(); save();
}
function focusCard(id) {
  const p = state.positions[id];
  const scale = Math.max(1.15, state.view.scale);
  state.view = { scale, x: innerWidth / 2 - (p.x + CARD_W / 2) * scale, y: (innerHeight - 80) / 2 - (p.y + CARD_H / 2) * scale };
  paint(); save();
}

function updateCard(point) {
  if (gesture.type === 'group') {
    const originals = gesture.ids.map(id => gesture.snapshot[id]);
    const dx = clamp((point.x - state.view.x) / state.view.scale - gesture.offset.x - gesture.original.x, -10000 - Math.min(...originals.map(p => p.x)), 10000 - Math.max(...originals.map(p => p.x)));
    const dy = clamp((point.y - state.view.y) / state.view.scale - gesture.offset.y - gesture.original.y, -10000 - Math.min(...originals.map(p => p.y)), 10000 - Math.max(...originals.map(p => p.y)));
    for (const id of gesture.ids) { state.positions[id].x = gesture.snapshot[id].x + dx; state.positions[id].y = gesture.snapshot[id].y + dy; }
    pushNeighbours();
    return;
  }
  const p = state.positions[gesture.id];
  p.x = clamp((point.x - state.view.x) / state.view.scale - gesture.offset.x, -10000, 10000);
  p.y = clamp((point.y - state.view.y) / state.view.scale - gesture.offset.y, -10000, 10000);
  pushNeighbours();
}
function collisionContact(a, b, clearance) {
  // Minkowski sum of two rounded cards plus the requested separation.
  const dx = a.x - b.x, dy = a.y - b.y;
  const qx = Math.abs(dx) - (CARD_W - 2 * COLLISION_RADIUS);
  const qy = Math.abs(dy) - (CARD_H - 2 * COLLISION_RADIUS);
  const radius = 2 * COLLISION_RADIUS + clearance;
  const outsideX = Math.max(qx, 0), outsideY = Math.max(qy, 0);
  const length = Math.hypot(outsideX, outsideY);
  const distance = length + Math.min(Math.max(qx, qy), 0) - radius;
  if (distance >= -.001) return null;
  const sx = dx < 0 ? -1 : 1, sy = dy < 0 ? -1 : 1;
  if (length > .0001) return { depth: -distance, nx: sx * outsideX / length, ny: sy * outsideY / length };
  return qx > qy ? { depth: -distance, nx: sx, ny: 0 } : { depth: -distance, nx: 0, ny: sy };
}
function overlaps(a, b, clearance = 0) { return collisionContact(a, b, clearance) !== null; }
function movementGroups(activeIds) {
  if (!state.confirmed || !state.review) return spatialClusters(activeIds).map(cardIds => ({ cardIds }));
  const excluded = new Set(activeIds);
  const groups = state.review.groups.map(group => ({ name: group.name, cardIds: group.cardIds.filter(id => !excluded.has(id)) })).filter(group => group.cardIds.length);
  const assigned = new Set([...activeIds, ...groups.flatMap(group => group.cardIds)]);
  for (const card of catalog) if (!assigned.has(card.id)) groups.push({ cardIds: [card.id] });
  return groups;
}
function pushOffset(ids, blockers) {
  const members = ids.map(id => state.positions[id]);
  const pairs = blockers.flatMap(blocker => blocker.cardIds.map(id => ({ position: state.positions[id], clearance: blocker.active && gesture.type === 'card' ? CARD_CLEARANCE : GROUP_CLEARANCE })));
  function deepest(dx, dy) {
    let contact = null;
    for (const p of members) for (const pair of pairs) {
      const candidate = collisionContact({ x: p.x + dx, y: p.y + dy }, pair.position, pair.clearance);
      if (candidate && (!contact || candidate.depth > contact.depth)) contact = candidate;
    }
    return contact;
  }
  let dx = 0, dy = 0;
  for (let i = 0; i < 24; i++) {
    const contact = deepest(dx, dy);
    if (!contact) return { dx, dy };
    dx += contact.nx * (contact.depth + .02);
    dy += contact.ny * (contact.depth + .02);
  }
  // A concave pocket can give opposing contact normals. Search several escape
  // directions only in that case, keeping the entire group rigid.
  let best = null;
  for (let i = 0; i < 32; i++) {
    const nx = Math.cos(i * Math.PI / 16), ny = Math.sin(i * Math.PI / 16);
    let high = 8;
    while (deepest(nx * high, ny * high)) high *= 2;
    let low = 0;
    for (let step = 0; step < 16; step++) {
      const middle = (low + high) / 2;
      if (deepest(nx * middle, ny * middle)) low = middle;
      else high = middle;
    }
    const distance = high + .03;
    if ((!best || distance < best.distance) && !deepest(nx * distance, ny * distance)) best = { dx: nx * distance, dy: ny * distance, distance };
  }
  return best;
}
function pushNeighbours() {
  const activeIds = gesture.type === 'group' ? gesture.ids : [gesture.id];
  const placed = [{ cardIds: activeIds, active: true }];
  const remaining = [...gesture.others];
  // Each encountered group becomes a fixed obstacle for the next one. The held
  // object follows the pointer; contact propagates outward without bouncing back.
  while (remaining.length) {
    const index = remaining.findIndex(group => group.cardIds.some(id => placed.some(blocker => {
      const clearance = blocker.active && gesture.type === 'card' ? CARD_CLEARANCE : GROUP_CLEARANCE;
      return blocker.cardIds.some(other => overlaps(state.positions[id], state.positions[other], clearance));
    })));
    if (index < 0) break;
    const group = remaining.splice(index, 1)[0];
    const offset = pushOffset(group.cardIds, placed);
    if (offset) for (const id of group.cardIds) {
      state.positions[id].x += offset.dx; state.positions[id].y += offset.dy;
      gesture.pushed.add(id);
    }
    placed.push(group);
  }
}
function edgePan() {
  if (!isCardGesture() || !gesture.moved) return;
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
  cancelHold();
  hint.classList.add('hidden');
  event.preventDefault();
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  viewport.setPointerCapture(event.pointerId);
  if (pointers.size === 2) {
    restoreDrag();
    stopAnimation();
    const [a, b] = [...pointers.values()];
    const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    gesture = { type: 'pinch', distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), scale: state.view.scale, anchor: { x: (center.x - state.view.x) / state.view.scale, y: (center.y - state.view.y) / state.view.scale } };
    paint(); return;
  }
  const id = event.target.closest('.card')?.dataset.id;
  const start = { x: event.clientX, y: event.clientY };
  if (id) {
    cardsElement.querySelector(`[data-id="${id}"]`).classList.remove('settling');
    const original = { ...state.positions[id] };
    selectedId = id;
    gesture = { type: 'card', id, start, original, snapshot: copy(state.positions), others: movementGroups([id]), pushed: new Set(), moved: false, offset: { x: (start.x - state.view.x) / state.view.scale - original.x, y: (start.y - state.view.y) / state.view.scale - original.y } };
    armGroupHold();
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
  } else if (isCardGesture()) {
    if (!gesture.moved && Math.hypot(point.x - gesture.start.x, point.y - gesture.start.y) >= 4) {
      cancelHold();
      gesture.moved = true;
      let z = Math.max(...Object.values(state.positions).map(p => p.z));
      const ids = gesture.type === 'group' ? [...gesture.ids].sort((a, b) => gesture.snapshot[a].z - gesture.snapshot[b].z) : [gesture.id];
      for (const id of ids) state.positions[id].z = ++z;
      animation = requestAnimationFrame(edgePan);
    }
    if (gesture.moved) updateCard(point);
  }
  paint();
}, { passive: false });

function finishPointer(event, cancelled = false) {
  if (!pointers.has(event.pointerId)) return;
  cancelHold();
  pointers.delete(event.pointerId);
  if (gesture?.type === 'pinch' && pointers.size === 1) {
    const start = pointers.values().next().value;
    gesture = { type: 'pan', start: { ...start }, view: { ...state.view } };
    save(); return;
  }
  if (!pointers.size) {
    stopAnimation();
    if (isCardGesture()) {
      if (cancelled) restoreDrag();
      else if (gesture.moved) {
        pushNeighbours();
        remember(gesture.snapshot, gesture.type === 'group');
        if (gesture.type !== 'group' || !state.confirmed) invalidate();
      }
      else if (gesture.type === 'card') {
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
  cancelHold(); restoreDrag();
  pointers.clear(); gesture = null; stopAnimation(); paint(); save();
});
viewport.addEventListener('contextmenu', event => event.preventDefault());
viewport.addEventListener('wheel', event => {
  event.preventDefault(); hint.classList.add('hidden');
  if (event.ctrlKey || event.metaKey) zoomAt(event.clientX, event.clientY, state.view.scale * Math.exp(-event.deltaY * 0.008));
  else { state.view.x -= event.deltaX; state.view.y -= event.deltaY; paint(); }
  save();
}, { passive: false });
viewport.addEventListener('keydown', event => {
  const id = event.target.closest('.card')?.dataset.id;
  const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (!id || !directions[event.key] || gesture) return;
  event.preventDefault();
  const snapshot = copy(state.positions);
  remember(snapshot);
  gesture = { type: 'card', id, snapshot, others: movementGroups([id]), pushed: new Set() };
  const [dx, dy] = directions[event.key];
  state.positions[id].x += dx * (event.shiftKey ? 40 : 12);
  state.positions[id].y += dy * (event.shiftKey ? 40 : 12);
  pushNeighbours(); gesture = null;
  invalidate(); paint(); save(); announce(`${cardName(id)} 위치 이동`);
});
viewport.addEventListener('focusin', event => {
  const id = event.target.closest('.card')?.dataset.id;
  if (!id) return;
  viewport.scrollLeft = 0; viewport.scrollTop = 0;
  const rect = event.target.getBoundingClientRect();
  if (rect.left < 8 || rect.top < 8 || rect.right > innerWidth - 8 || rect.bottom > innerHeight - 75) focusCard(id);
});

function spatialClusters(excludedIds = []) {
  const excluded = new Set(excludedIds);
  const active = catalog.filter(card => !excluded.has(card.id));
  const parents = active.map((_, i) => i);
  function find(i) { while (parents[i] !== i) { parents[i] = parents[parents[i]]; i = parents[i]; } return i; }
  for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) {
    const a = state.positions[active[i].id], b = state.positions[active[j].id];
    const dx = Math.max(0, a.x - b.x - CARD_W, b.x - a.x - CARD_W);
    const dy = Math.max(0, a.y - b.y - CARD_H, b.y - a.y - CARD_H);
    if (Math.hypot(dx, dy) <= GAP) parents[find(i)] = find(j);
  }
  const clusters = new Map();
  active.forEach((card, i) => { const root = find(i); if (!clusters.has(root)) clusters.set(root, []); clusters.get(root).push(card.id); });
  return [...clusters.values()];
}
function inferGroups() {
  const groups = [], singles = [];
  for (const ids of spatialClusters()) {
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
function resetTest() {
  cancelHold(); stopAnimation(); clearTimeout(toastTimer);
  pointers.clear(); gesture = null; history = []; selectedId = null; lastTap = null; previewGroups = [];
  if (reviewDialog.open) reviewDialog.close();
  reviewDialog.innerHTML = '';
  document.querySelector('#toast').classList.remove('visible');
  try { localStorage.removeItem(storageKey); } catch {}
  state = initial();
  renderCards(); save();
  announce('저장된 배치와 분류를 지우고 다시 시작했다.');
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  if (action === 'reset-test') resetTest();
  else if (action === 'zoom-in' || action === 'zoom-out') { zoomAt(innerWidth / 2, (innerHeight - 70) / 2, state.view.scale * (action === 'zoom-in' ? 1.25 : 0.8)); save(); }
  else if (action === 'fit') fitAll();
  else if (action === 'undo' && history.length) {
    const previous = history.pop();
    state.positions = previous.positions;
    if (previous.classification) Object.assign(state, previous.classification);
    else invalidate();
    paint(); save();
  }
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
