const list = value => Array.isArray(value) ? value : [];
const obj = value => value && typeof value === 'object' && !Array.isArray(value);
const decode = value => typeof value === 'string' ? JSON.parse(value) : value;
export function unpack(input) {
  input = decode(input);
  if (Array.isArray(input)) return input.flatMap(unpack);
  if (!obj(input)) throw Error('응답 객체 또는 응답 배열이 필요합니다.');
  if (input.payload || input.kind) return [input];
  for (const key of ['rows', 'data', 'responses', 'records']) if (Array.isArray(input[key])) return input[key].flatMap(unpack);
  throw Error('응답의 payload를 찾지 못했습니다.');
}
export function normalize(row) {
  const p = decode(row.payload ?? row);
  if (p.kind !== 'portal_post_sort_survey') throw Error('카드 분류 최종 응답이 아닙니다. 사전 설문 단독 응답은 제외합니다.');
  const cards = p.cards;
  if (!Array.isArray(cards) || !cards.length || cards.some(c => !obj(c) || typeof c.id !== 'string' || !c.id || typeof c.name !== 'string')) throw Error('카드 목록이 올바르지 않습니다.');
  const ids = new Set(cards.map(c => c.id));
  if (ids.size !== cards.length) throw Error('카드 ID가 중복되어 있습니다.');
  const sort = p.sort_result;
  if (!obj(sort) || !Array.isArray(sort.groups)) throw Error('분류 결과가 없습니다.');
  const assigned = new Map();
  const groupIds = new Set();
  const groups = sort.groups.map((g,i) => {
    if (!obj(g) || !Array.isArray(g.card_ids) || !g.card_ids.length) throw Error('그룹의 카드 목록이 올바르지 않습니다.');
    const gid = String(g.id ?? `group-${i}`);
    if (groupIds.has(gid)) throw Error('그룹 ID가 중복되어 있습니다.');
    groupIds.add(gid);
    for (const id of g.card_ids) {
      if (!ids.has(id) || assigned.has(id)) throw Error('그룹에 알 수 없거나 중복된 카드가 있습니다.');
      assigned.set(id,gid);
    }
    return {id:gid,name:String(g.name || '이름 없는 그룹'),card_ids:[...g.card_ids]};
  });
  const singles = list(sort.ungrouped_card_ids);
  if (new Set(singles).size !== singles.length || singles.some(id => !ids.has(id) || assigned.has(id))) throw Error('따로 둔 카드에 중복 또는 알 수 없는 ID가 있습니다.');
  const ungrouped = cards.filter(c => !assigned.has(c.id)).map(c => c.id);
  const warning = ungrouped.length !== singles.length ? '소속 정보가 빠진 카드는 따로 둔 카드로 표시했습니다.' : '';
  const preRecord = decode(p.pre_survey ?? {});
  const pre = decode(preRecord.payload ?? preRecord);
  const answers = obj(p.answers) ? p.answers : {};
  for (const key of ['difficult_cards','naming_difficult_cards']) {
    if (answers[key] !== undefined && (!Array.isArray(answers[key]) || answers[key].some(a => !obj(a) || !ids.has(a.card_id)) || new Set(answers[key].map(a=>a.card_id)).size!==answers[key].length)) throw Error('사후 질문의 카드 목록이 올바르지 않습니다.');
  }
  const cohort = JSON.stringify([row.study_version ?? '버전 미기록', [...cards].sort((a,b)=>a.id.localeCompare(b.id)).map(c => [c.id,c.name,c.description ?? ''])]);
  return {id:String(row.id ?? ''),raw:row,p,pre,answers,cards,groups,assigned,ungrouped,cohort,warning,isTest:row.is_test === true ? 'test' : row.is_test === false ? 'live' : 'unknown',version:row.study_version ?? '버전 미기록'};
}
export function pairStats(records, a, b) {
  let together=0, eligible=0;
  for (const r of records) if (r.assigned.has(a) && r.assigned.has(b)) {
    eligible++;
    if (r.assigned.get(a) === r.assigned.get(b)) together++;
  }
  return {together,eligible,rate:eligible ? together/eligible : null};
}
export function difficultyStats(records, cardId, key) {
  const eligible=records.filter(r=>r.cards.some(c=>c.id===cardId) && Array.isArray(r.answers[key]));
  const count=eligible.filter(r=>r.answers[key].some(a=>a.card_id===cardId)).length;
  return {count,total:eligible.length};
}
