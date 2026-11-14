import { integrated, urls } from '../study/flow.js?v=journey-2';
import { cardNames } from '../test/cards.js';

const practice = new URLSearchParams(location.search).get('practice') === '1';
const CARD_W = 144, CARD_H = 70, GAP = 24;
const CARD_CLEARANCE = 8, COLLISION_RADIUS = 16;
const GROUP_PADDING = 20, GROUP_RADIUS = 18, GROUP_OUTLINE_GAP = 12;
const GROUP_CLEARANCE = GROUP_PADDING * 2 + GROUP_OUTLINE_GAP;
// Interaction-test copy only; these descriptions are not verified portal documentation.
const testDescriptions = [
  '이번 학기에 수강한 과목의 성적을 확인하는 화면입니다.',
  '학기별로 나누어 이전 성적 기록을 살펴볼 수 있습니다.',
  '졸업에 필요한 조건을 얼마나 충족했는지 확인하는 기능입니다.',
  '필수 과목을 이수했는지 확인하는 화면입니다.',
  '원하는 교과목의 정보를 찾아보는 기능입니다.',
  '전공에서 어떤 과목을 배우는지 교육과정을 살펴볼 수 있습니다.',
  '교과목과 관련된 자료와 정보를 모아 확인하는 화면입니다.',
  '신청한 수업 목록과 신청 내역을 확인하는 기능입니다.',
  '수업별 출석 기록을 확인하는 화면입니다.',
  '강의에 대한 평가 결과를 찾아보는 기능입니다.',
  '계절학기에 듣고 싶은 수업의 수요를 제출하는 기능입니다.',
  '일정 기간 학업을 쉬기 위한 신청을 진행합니다.',
  '소속 학과를 변경하기 위한 신청을 진행합니다.',
  '전공을 신청하거나 신청한 전공을 포기하는 기능입니다.',
  '납부할 등록금이 적힌 고지서를 출력하는 기능입니다.',
  '납부한 금액과 납부 내역을 확인하는 화면입니다.',
  '등록금을 여러 차례 나누어 납부하도록 신청하는 기능입니다.',
  '지금까지 받은 장학금 내역을 살펴볼 수 있습니다.',
  '교내 장학금에 지원하기 위한 신청 화면입니다.',
  '포털에서 제공하는 증명서를 발급받는 기능입니다.',
  '포털 로그인에 사용하는 비밀번호를 변경합니다.',
  '등록된 개인 정보를 확인하고 수정하는 화면입니다.',
  '포털 이용 환경과 로그인 관련 설정을 변경하는 기능입니다.',
  '포털에서 사용하는 아이디를 변경하는 기능입니다.',
  '로그인 인증에 사용할 일회용 인증 수단을 설정하는 기능입니다.',
  '학교 메일을 신청하거나 메일 서비스로 이동하는 기능입니다.',
  '정규 수업 외의 프로그램에 참여를 신청하는 기능입니다.',
  '참여한 비교과 프로그램과 활동 내역을 살펴볼 수 있습니다.',
  '고민이나 학습에 관해 상담받기 위해 신청하는 기능입니다.',
  '현장실습 기관을 찾아보고 실습 참여를 신청하는 기능입니다.',
];
const practiceNames = ['사과', '바나나', '연필', '지우개'];
const catalog = (practice ? practiceNames : cardNames).map((name, i) => ({ id: `card-${i + 1}`, name, description: practice ? ['아삭한 식감의 과일입니다.', '껍질을 벗겨 먹는 과일입니다.', '글씨를 쓰거나 그림을 그리는 도구입니다.', '연필로 쓴 내용을 지우는 도구입니다.'][i] : testDescriptions[i] }));
const viewport = document.querySelector('#viewport');
const world = document.querySelector('#world');
const cardsElement = document.querySelector('#cards');
const outlines = document.querySelector('#outlines');
const reviewDialog = document.querySelector('#review');
const hint = document.querySelector('#hint');
const detailPanel = document.querySelector('#card-detail');
let detailCardId = null;
const storageKey = practice ? 'hyu-card-sort-practice-v1' : 'hyu-spatial-card-sort-snap-collision-v1';
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const cardName = id => catalog.find(card => card.id === id)?.name || '';
const copy = value => JSON.parse(JSON.stringify(value));
function overviewView(positions) {
  const points = Object.values(positions);
  const left = Math.min(...points.map(p => p.x)), top = Math.min(...points.map(p => p.y));
  const width = Math.max(...points.map(p => p.x + CARD_W)) - left;
  const height = Math.max(...points.map(p => p.y + CARD_H)) - top;
  const headerHeight = integrated ? 49 : 0;
  const availableHeight = Math.max(1, innerHeight - 84 - headerHeight - (practice ? 180 : 0));
  const scale = clamp(Math.min((innerWidth - 32) / width, (availableHeight - 32) / height), 0.01, 1.5);
  return { scale, x: (innerWidth - width * scale) / 2 - left * scale, y: headerHeight + (availableHeight - height * scale) / 2 - top * scale };
}
function initial(existingOrder) {
  const cols = practice ? 2 : 5, rows = Math.ceil(catalog.length / cols);
  const stepX = CARD_W + 48;
  const side = (cols - 1) * stepX + CARD_W;
  const stepY = rows > 1 ? (side - CARD_H) / (rows - 1) : 0;
  const order = existingOrder || [...catalog];
  if (!existingOrder) for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const positions = {};
  order.forEach((card, index) => { positions[card.id] = { x: (index % cols) * stepX, y: Math.floor(index / cols) * stepY, z: index + 1 }; });
  return { positions, view: overviewView(positions), review: null, confirmed: false, layoutVersion: 'square-v1', descriptionViews: {} };
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
try { const value = JSON.parse((practice ? sessionStorage : localStorage).getItem(storageKey) || 'null'); if (valid(value)) state = value; } catch {}
if (state && isUntouchedOldGrid(state)) {
  const order = [...catalog].sort((a, b) => state.positions[a.id].y - state.positions[b.id].y || state.positions[a.id].x - state.positions[b.id].x);
  state = initial(order);
}
state ||= initial();
if (state.groupTerminologyVersion !== 1) {
  for (const group of state.review?.groups || []) group.name = group.name.replace(/^묶음 (\d+)$/, '그룹 $1');
  state.groupTerminologyVersion = 1;
}
state.descriptionViews ||= {};
if (new URLSearchParams(location.search).get('resume') !== 'post-survey') state.view = overviewView(state.positions);
const pointers = new Map();
let gesture = null;
let animation = null;
let history = [];
let future = [];
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
    const group = ensureGroups().groups.find(group => group.cardIds.includes(pending.id));
    if (!group) return;
    pending.type = 'group'; pending.ids = [...group.cardIds]; pending.groupName = group.name; pending.groupId = group.id; pending.groupTone = group.tone;
    pending.others = movementGroups(pending.ids);
    lastTap = null;
    announce(`${pending.ids.length}개 그룹 선택`);
    paint();
  }, 500);
}

function save() { try { (practice ? sessionStorage : localStorage).setItem(storageKey, JSON.stringify(state)); } catch {} if(practice) window.dispatchEvent(new CustomEvent('practice-state',{detail:{review:state.review,views:state.descriptionViews}})); }
function announce(text) { document.querySelector('#announcer').textContent = text; }
function notify(text) { const el = document.querySelector('#toast'); clearTimeout(toastTimer); el.textContent = text; el.classList.add('visible'); toastTimer = setTimeout(() => el.classList.remove('visible'), 2600); announce(text); }
function remember(snapshot) {
  history.push({ positions: snapshot, classification: { review: copy(ensureGroups()), confirmed: state.confirmed, confirmedAt: state.confirmedAt } });
  if (history.length > 20) history.shift();
  future = [];
  updateControls();
}
function historySnapshot() {
  return { positions: copy(state.positions), classification: { review: copy(state.review ?? null), confirmed: !!state.confirmed, confirmedAt: state.confirmedAt } };
}
function restoreHistory(entry) {
  state.positions = copy(entry.positions);
  if (entry.classification) Object.assign(state, entry.classification);
  else invalidate();
  paint(); save();
}
function ensureGroups() {
  state.review ||= inferGroups();
  state.review.groups.forEach((group, i) => { group.tone ??= i % 4; });
  return state.review;
}
function refreshSingles() {
  const review = ensureGroups();
  review.groups = review.groups.filter(group => group.cardIds.length);
  const assigned = new Set(review.groups.flatMap(group => group.cardIds));
  review.singles = catalog.filter(card => !assigned.has(card.id)).map(card => card.id);
}
function commitCardMove(id, snap) {
  const review = ensureGroups();
  const source = review.groups.find(group => group.cardIds.includes(id));
  const sourceSize = source?.cardIds.length || 0;
  const target = snap?.targetGroupId ? review.groups.find(group => group.id === snap.targetGroupId) : null;
  if (snap) {
    if (source && source !== target) source.cardIds = source.cardIds.filter(member => member !== id);
    if (target) target.cardIds = [...new Set([...target.cardIds, ...snap.ids])];
    else {
      const number = Math.max(review.nextGroup || 1, 1);
      review.nextGroup = number + 1;
      review.groups.push({ id: crypto.randomUUID(), name: `그룹 ${number}`, tone: [0, 1, 2, 3].find(tone => !review.groups.some(group => group.tone === tone)) ?? number % 4, cardIds: [...snap.ids] });
    }
  } else if (source && source.cardIds.length > 1) {
    const p = state.positions[id];
    const stillInside = source.cardIds.some(member => {
      if (member === id) return false;
      const other = state.positions[member];
      return Math.hypot(Math.max(0, p.x - other.x - CARD_W, other.x - p.x - CARD_W), Math.max(0, p.y - other.y - CARD_H, other.y - p.y - CARD_H)) <= GAP;
    });
    if (!stillInside) source.cardIds = source.cardIds.filter(member => member !== id);
  }
  refreshSingles();
  if (source?.cardIds.length && source.cardIds.length < sourceSize) arrangeRemainingGroup(source);
}
function invalidate() { state.confirmed = false; drawOutlines(); updateControls(); }
function updateControls() {
  document.querySelector('[data-action=undo]').disabled = !history.length;
  document.querySelector('[data-action=redo]').disabled = !future.length;
  document.querySelector('[data-action=review]').textContent = state.confirmed ? '그룹 보기' : '그룹 확인';
}

function positionCardDetail() {
  if (detailPanel.hidden || !detailCardId) return;
  if (innerWidth <= 700) {
    const visual = window.visualViewport;
    const keyboardInset = visual ? Math.max(0, innerHeight - visual.height - visual.offsetTop) : 0;
    detailPanel.style.left = '12px'; detailPanel.style.top = 'auto';
    detailPanel.style.bottom = `calc(${74 + keyboardInset}px + env(safe-area-inset-bottom))`;
    detailPanel.style.maxHeight = `${Math.max(140, Math.min(420, (visual?.height || innerHeight) - 100))}px`;
    return;
  }
  detailPanel.style.bottom = 'auto'; detailPanel.style.maxHeight = 'calc(100dvh - 100px)';
  const rect = cardsElement.querySelector(`[data-id="${detailCardId}"]`).getBoundingClientRect();
  const width = detailPanel.offsetWidth, height = detailPanel.offsetHeight;
  let left = rect.right + 12;
  if (left + width > innerWidth - 12) left = rect.left - width - 12;
  detailPanel.style.left = `${clamp(left, 12, Math.max(12, innerWidth - width - 12))}px`;
  detailPanel.style.top = `${clamp(rect.top, 12, Math.max(12, innerHeight - height - 78))}px`;
}
function closeCardDetail(restoreFocus = false) {
  const previous = detailCardId;
  if (!restoreFocus && detailPanel.contains(document.activeElement)) document.activeElement.blur();
  detailPanel.hidden = true; detailCardId = null;
  document.querySelector('#single-group-form').hidden = true;
  if (restoreFocus && previous) cardsElement.querySelector(`[data-id="${previous}"]`)?.focus({ preventScroll: true });
}
function openCardDetail(id) {
  const card = catalog.find(card => card.id === id);
  if (!card) return;
  detailCardId = id;
  document.querySelector('#detail-title').textContent = card.name;
  document.querySelector('#detail-description').textContent = card.description;
  document.querySelector('#single-group-form').hidden = true;
  document.querySelector('#single-group-name').value = '';
  document.querySelector('#start-single-group').hidden = ensureGroups().groups.some(group => group.cardIds.includes(id));
  detailPanel.hidden = false; positionCardDetail();
  document.querySelector('#close-card-detail').focus({ preventScroll: true });
  const now = new Date().toISOString(), previous = state.descriptionViews[id];
  state.descriptionViews[id] = { count: (previous?.count || 0) + 1, firstViewedAt: previous?.firstViewedAt || now, lastViewedAt: now, descriptionVersion: 'test-v1' };
  save();
}
document.querySelector('#close-card-detail').addEventListener('click', () => closeCardDetail(true));
document.querySelector('#start-single-group').addEventListener('click', () => {
  if (!detailCardId || ensureGroups().groups.some(group => group.cardIds.includes(detailCardId))) return;
  document.querySelector('#start-single-group').hidden = true;
  document.querySelector('#single-group-form').hidden = false;
  positionCardDetail(); document.querySelector('#single-group-name').focus({ preventScroll: true });
});
document.querySelector('#single-group-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!detailCardId || ensureGroups().groups.some(group => group.cardIds.includes(detailCardId))) return;
  const requestedName = document.querySelector('#single-group-name').value.trim();
  remember(copy(state.positions));
  const review = ensureGroups();
  let number = review.nextGroup || 1;
  if (!requestedName) while (review.groups.some(group => group.name === `그룹 ${number}`)) number++;
  const name = requestedName || `그룹 ${number}`;
  review.nextGroup = number + 1;
  review.groups.push({ id: crypto.randomUUID(), name, tone: [0, 1, 2, 3].find(tone => !review.groups.some(group => group.tone === tone)) ?? number % 4, cardIds: [detailCardId] });
  refreshSingles(); closeCardDetail(); invalidate(); paint(); save(); announce('한 장짜리 그룹을 만들었다.');
});
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !detailPanel.hidden) { event.preventDefault(); closeCardDetail(true); } });
window.visualViewport?.addEventListener('resize', positionCardDetail);

function renderCards() {
  cardsElement.innerHTML = catalog.map(card => `<div class="card" tabindex="0" role="button" aria-label="${escape(card.name)}. 눌러서 설명 보기, 끌어서 이동" data-id="${card.id}"><span>${escape(card.name)}</span></div>`).join('');
  paint();
}
function paint() {
  const snap = isCardGesture() && gesture.moved ? makeSnapPlan() : null;
  if (isCardGesture()) gesture.snapPlan = snap;
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
  let outlinedTarget = false;
  for (const outline of outlines.querySelectorAll('.group-outline')) {
    const target = !!snap && outline.dataset.cards.split(',').includes(snap.targetIds[0]) && !outline.classList.contains('group-held');
    outline.classList.toggle('magnet-group', target);
    outlinedTarget ||= target;
  }
  for (const el of cardsElement.querySelectorAll('.card')) el.classList.toggle('magnet-target', !!snap && !outlinedTarget && snap.targetIds.includes(el.dataset.id));
  updateControls();
}

function drawOutlines() {
  const confirmed = state.confirmed && state.review && !(gesture?.type === 'card' && gesture.moved);
  let groups = ensureGroups().groups.map(group => ({ ...group }));
  if ((isCardGesture() && gesture.moved) || gesture?.type === 'group') {
    // Show one common outline for exactly the cards in the pending merge.
    const snap = gesture.type === 'card' ? gesture.snapPlan : null;
    const targets = new Set(snap?.targetIds || []);
    groups = gesture.others.filter(group => (group.id || group.cardIds.length > 1) && !group.cardIds.some(id => targets.has(id))).map(group => ({ ...group }));
    if (snap) groups.push({ cardIds: snap.ids, name: snap.targetName, tone: snap.targetTone });
    if (gesture.type === 'group') groups.push({ id: gesture.groupId, cardIds: gesture.ids, name: gesture.groupName, tone: gesture.groupTone, held: true });
    else if (!snap) {
      const single = state.review.groups.find(group => group.cardIds.length === 1 && group.cardIds[0] === gesture.id);
      if (single) groups.push({ ...single });
    }
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
      if (match) { group.tone ??= match.tone; available.delete(match); }
      else group.tone ??= [0, 1, 2, 3].find(tone => !usedTones.has(tone)) ?? groups.indexOf(group) % 4;
      usedTones.add(group.tone);
    }
    previewGroups = groups;
  }
  const markup = groups.map((group, index) => {
    const positions = group.cardIds.map(id => state.positions[id]);
    const x = Math.min(...positions.map(p => p.x)) - GROUP_PADDING;
    const y = Math.min(...positions.map(p => p.y)) - GROUP_PADDING;
    const right = Math.max(...positions.map(p => p.x + CARD_W)) + GROUP_PADDING;
    const bottom = Math.max(...positions.map(p => p.y + CARD_H)) + GROUP_PADDING;
    const anchor = [...positions].sort((a, b) => a.y - b.y || a.x - b.x)[0];
    const label = group.name?.trim() || null;
    const labelMarkup = label ? `<span style="left:${anchor.x - x + 4}px;top:${anchor.y - y - 19}px">${escape(label)}</span>` : '';
    const width = right - x, height = bottom - y;
    return `<div aria-hidden="true" class="group-outline ${confirmed ? 'confirmed' : 'preview'} ${group.held ? 'group-held' : ''} tone-${group.tone ?? index % 4}" data-cards="${group.cardIds.join(',')}" style="left:${x}px;top:${y}px;width:${width}px;height:${height}px"><svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><path fill-rule="evenodd" d="${roundedContour(positions, x, y)}"/></svg>${labelMarkup}</div>`;
  }).join('');
  if (markup !== outlineMarkup) { outlines.innerHTML = markup; outlineMarkup = markup; }
}

function roundedContour(positions, originX, originY) {
  // Trace the union of padded card rectangles, retaining concave gaps and holes.
  // Coordinate compression keeps the work bounded by card count, not world size.
  const rectangles = positions.map(p => ({ left: p.x - GROUP_PADDING, right: p.x + CARD_W + GROUP_PADDING, top: p.y - GROUP_PADDING, bottom: p.y + CARD_H + GROUP_PADDING }));
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
      const radius = Math.min(GROUP_RADIUS, incoming / 2, outgoing / 2);
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

const SNAP_GAP = 12;
function makeSnapPlan() {
  if (gesture?.type !== 'card') return null;
  const id = gesture.id, p = state.positions[id];
  const candidates = gesture.others.map(group => {
    let distance = Infinity, center = Infinity;
    for (const other of group.cardIds) {
      const target = state.positions[other];
      const edge = Math.hypot(Math.max(0, p.x - target.x - CARD_W, target.x - p.x - CARD_W), Math.max(0, p.y - target.y - CARD_H, target.y - p.y - CARD_H));
      const middle = Math.hypot(p.x - target.x, p.y - target.y);
      if (edge < distance || edge === distance && middle < center) { distance = edge; center = middle; }
    }
    return { group, distance, center };
  }).filter(candidate => candidate.distance <= 28).sort((a, b) => a.distance - b.distance || a.center - b.center);
  for (const { group } of candidates) {
    // Hint and drop share this complete group and these exact final placements.
    const ids = [id, ...group.cardIds].sort((a, b) => state.positions[a].y - state.positions[b].y || state.positions[a].x - state.positions[b].x);
    const grid = chooseGrid(ids.length), origin = arrangementOrigin(grid, ids);
    if (!origin) continue;
    const placements = Object.fromEntries(ids.map((member, i) => [member, {
      x: origin.x + (i % grid.cols) * (CARD_W + SNAP_GAP),
      y: origin.y + Math.floor(i / grid.cols) * (CARD_H + SNAP_GAP)
    }]));
    const destination = group.id ? group : ensureGroups().groups.find(existing => existing.cardIds.length === 1 && existing.cardIds[0] === id);
    return { ids, targetIds: [...group.cardIds], targetGroupId: destination?.id || null, targetName: destination?.name, targetTone: destination?.tone, placements };
  }
  return null;
}
function applySnap(plan) {
  for (const id of plan.ids) Object.assign(state.positions[id], plan.placements[id]);
}
function chooseGrid(count) {
  const stages = [[3, 1], [8, 2], [15, 3], [24, 4], [Infinity, 5]];
  const cols = stages.find(([limit]) => count <= limit)[1];
  const rows = Math.ceil(count / cols);
  return { cols, rows, width: cols * CARD_W + (cols - 1) * SNAP_GAP, height: rows * CARD_H + (rows - 1) * SNAP_GAP };
}
function arrangeRemainingGroup(group) {
  if (group.cardIds.length < 2) return;
  const ids = [...group.cardIds].sort((a, b) => state.positions[a].y - state.positions[b].y || state.positions[a].x - state.positions[b].x);
  const grid = chooseGrid(ids.length), origin = arrangementOrigin(grid, ids);
  if (!origin) return;
  ids.forEach((id, i) => {
    state.positions[id].x = origin.x + (i % grid.cols) * (CARD_W + SNAP_GAP);
    state.positions[id].y = origin.y + Math.floor(i / grid.cols) * (CARD_H + SNAP_GAP);
  });
  animateArrangement(ids);
}
function arrangementOrigin(grid, ids) {
  const members = new Set(ids), points = ids.map(id => state.positions[id]);
  const left = Math.min(...points.map(p => p.x)), right = Math.max(...points.map(p => p.x + CARD_W));
  const top = Math.min(...points.map(p => p.y)), bottom = Math.max(...points.map(p => p.y + CARD_H));
  const maxX = 10000 - (grid.cols - 1) * (CARD_W + SNAP_GAP), maxY = 10000 - (grid.rows - 1) * (CARD_H + SNAP_GAP);
  const preferred = { x: clamp((left + right - grid.width) / 2, -10000, maxX), y: clamp((top + bottom - grid.height) / 2, -10000, maxY) };
  const outside = catalog.filter(card => !members.has(card.id)).map(card => state.positions[card.id]);
  const margin = GROUP_CLEARANCE;
  const free = p => outside.every(other => p.x + grid.width + margin <= other.x + .001 || other.x + CARD_W + margin <= p.x + .001 || p.y + grid.height + margin <= other.y + .001 || other.y + CARD_H + margin <= p.y + .001);
  if (free(preferred)) return preferred;
  const xs = new Set([preferred.x, -10000, maxX]), ys = new Set([preferred.y, -10000, maxY]);
  for (const other of outside) {
    xs.add(clamp(other.x - grid.width - margin, -10000, maxX)); xs.add(clamp(other.x + CARD_W + margin, -10000, maxX));
    ys.add(clamp(other.y - grid.height - margin, -10000, maxY)); ys.add(clamp(other.y + CARD_H + margin, -10000, maxY));
  }
  const candidates = [];
  for (const x of xs) for (const y of ys) candidates.push({ x, y });
  candidates.sort((a, b) => (a.x - preferred.x) ** 2 + (a.y - preferred.y) ** 2 - (b.x - preferred.x) ** 2 - (b.y - preferred.y) ** 2);
  return candidates.find(free);
}
function animateArrangement(ids) {
  for (const id of ids) {
    const el = cardsElement.querySelector(`[data-id="${id}"]`);
    el.classList.add('snap-settling');
    setTimeout(() => el.classList.remove('snap-settling'), 170);
  }
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
  // Whole-group contact uses the same padded, rounded boundary as its outline.
  const grouped = clearance === GROUP_CLEARANCE;
  const padding = grouped ? GROUP_PADDING : 0;
  const corner = grouped ? GROUP_RADIUS : COLLISION_RADIUS;
  const separation = grouped ? GROUP_OUTLINE_GAP : clearance;
  const dx = a.x - b.x, dy = a.y - b.y;
  const qx = Math.abs(dx) - (CARD_W + padding * 2 - corner * 2);
  const qy = Math.abs(dy) - (CARD_H + padding * 2 - corner * 2);
  const radius = 2 * corner + separation;
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
  const excluded = new Set(activeIds);
  const groups = ensureGroups().groups.map(group => ({ ...group, cardIds: group.cardIds.filter(id => !excluded.has(id)) })).filter(group => group.cardIds.length);
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
  closeCardDetail();
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
    cardsElement.querySelector(`[data-id="${id}"]`).classList.remove('settling', 'snap-settling');
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
  let showDetail = null;
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
        const wasGroup = gesture.type === 'group';
        const snap = gesture.snapPlan;
        if (snap) { applySnap(snap); animateArrangement(snap.ids); }
        remember(gesture.snapshot);
        if (!wasGroup) commitCardMove(gesture.id, snap);
        if (snap || !wasGroup || !state.confirmed) invalidate();
      }
      else if (gesture.type === 'card') {
        if (lastTap?.id === gesture.id && Date.now() - lastTap.time < 330) focusCard(gesture.id);
        else showDetail = gesture.id;
        lastTap = { id: gesture.id, time: Date.now() };
      }
    }
    gesture = null; paint(); save();
    if (showDetail) openCardDetail(showDetail);
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
  closeCardDetail();
  event.preventDefault(); hint.classList.add('hidden');
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
  const delta = clamp(event.deltaY * unit, -240, 240);
  const sensitivity = event.ctrlKey || event.metaKey ? .008 : .002;
  zoomAt(event.clientX, event.clientY, state.view.scale * Math.exp(-delta * sensitivity));
  save();
}, { passive: false });
viewport.addEventListener('keydown', event => {
  const id = event.target.closest('.card')?.dataset.id;
  if (id && !gesture && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openCardDetail(id); return; }
  const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (!id || !directions[event.key] || gesture) return;
  event.preventDefault();
  const snapshot = copy(state.positions);
  remember(snapshot);
  gesture = { type: 'card', id, snapshot, others: movementGroups([id]), pushed: new Set() };
  const [dx, dy] = directions[event.key];
  state.positions[id].x += dx * (event.shiftKey ? 40 : 12);
  state.positions[id].y += dy * (event.shiftKey ? 40 : 12);
  pushNeighbours();
  commitCardMove(id, null);
  gesture = null;
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
    else groups.push({ id: crypto.randomUUID(), name: `그룹 ${groups.length + 1}`, cardIds: ids });
  }
  return { groups, singles, nextGroup: groups.length + 1, inferred: { groups: copy(groups), singles: [...singles] } };
}

function reviewRows(ids) {
  return ids.map(id => `<div class="review-card">${escape(cardName(id))}</div>`).join('');
}
function renderReview() {
  const result = state.review;
  reviewDialog.innerHTML = `<div class="review-heading"><h1>그룹 확인</h1><button type="button" class="close-review" data-action="back" aria-label="닫기">×</button></div><div class="review-scroll"><div class="review-groups">${result.groups.map((group, index) => `<section class="review-group tone-${index % 4}"><div class="review-group-heading"><label><span class="sr-only">그룹 이름</span><input type="text" data-group-name="${group.id}" value="${escape(group.name)}" placeholder="그룹 이름" maxlength="60" aria-label="${index + 1}번째 그룹 이름"></label></div>${reviewRows(group.cardIds)}</section>`).join('')}</div>${result.singles.length ? `<section class="single-section"><h2>따로 둔 카드</h2><div class="single-cards">${reviewRows(result.singles)}</div></section>` : ''}</div><div class="review-actions"><button type="button" class="back-button" data-action="back">돌아가기</button><button type="button" class="confirm-button" data-action="confirm">완료</button></div>`;
}
function showReview() {
  ensureGroups();
  renderReview(); reviewDialog.showModal(); save();
}
function resetTest() {
  cancelHold(); stopAnimation(); clearTimeout(toastTimer);
  pointers.clear(); gesture = null; history = []; future = []; selectedId = null; lastTap = null; previewGroups = [];
  if (reviewDialog.open) reviewDialog.close();
  reviewDialog.innerHTML = '';
  document.querySelector('#toast').classList.remove('visible');
  try { (practice ? sessionStorage : localStorage).removeItem(storageKey); } catch {}
  state = initial();
  renderCards(); save();
  announce('저장된 배치와 분류를 지우고 다시 시작했다.');
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  closeCardDetail();
  if (action === 'reset-test') resetTest();
  else if (action === 'fit') fitAll();
  else if (action === 'undo' && history.length) {
    future.push(historySnapshot());
    restoreHistory(history.pop());
  }
  else if (action === 'redo' && future.length) {
    history.push(historySnapshot());
    restoreHistory(future.pop());
  }
  else if (action === 'review') showReview();
  else if (action === 'back') { reviewDialog.close(); updateControls(); save(); }
  else if (action === 'confirm') {
    state.review.groups.forEach((g, i) => { g.name = g.name.trim() || `그룹 ${i + 1}`; });
    const ids = [...state.review.singles, ...state.review.groups.flatMap(g => g.cardIds)];
    if (ids.length !== catalog.length || new Set(ids).size !== catalog.length) { notify('카드 분류를 다시 확인해야 한다.'); return; }
    future = [];
    state.confirmed = true; state.confirmedAt = new Date().toISOString();
    reviewDialog.close(); drawOutlines(); updateControls(); save();
    if (practice) { window.dispatchEvent(new Event('practice-finished')); return; }
    location.assign(integrated ? urls['post-1'] : '../post-survey/?stage=select&from=canvas&v=flow-8');
  }
});
reviewDialog.addEventListener('input', event => {
  const group = state.review.groups.find(g => g.id === event.target.dataset.groupName);
  if (group) { future = []; group.name = event.target.value; state.confirmed = false; drawOutlines(); updateControls(); save(); }
});
window.addEventListener('resize', () => { paint(); positionCardDetail(); });
setTimeout(() => hint.classList.add('hidden'), 6500);
renderCards(); drawOutlines(); save();
