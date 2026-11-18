import {unpack,normalize,pairStats,difficultyStats} from './data.js?v=viewer-1';
import {cards as sampleCards} from '../canvas-50/cards.js?v=verified-descriptions-10';
const $=id=>document.getElementById(id), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const arr=v=>Array.isArray(v)?v:[], number=(v)=>typeof v==='number'&&v>=1&&v<=5?v:null;
let records=[], cohortKeys=[], active=[], tab='overview', example=false;
const labels={similar_purpose:'기능의 목적이나 용도',similar_context:'기능을 사용하는 상황',expected_portal_location:'포털에서 함께 있을 것 같은지',familiar_menu_structure:'기존 포털 메뉴 구조',other:'기타'};
function status(message,issues=[]){$('status').textContent=message;$('issues').innerHTML=issues.map(s=>`<li>${esc(s)}</li>`).join('');}
function bar(label,value,total){const pct=total?value/total*100:0;return `<div class="bar-row"><span>${esc(label)}</span><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div><span class="bar-value">${value}/${total}</span></div>`;}
function rebuild(){
 const previous=cohortKeys[Number($('cohort').value)];
 cohortKeys=[...new Set(records.map(r=>r.cohort))];
 $('cohort').innerHTML=cohortKeys.map((key,i)=>{const subset=records.filter(r=>r.cohort===key);return `<option value="${i}">${esc(subset[0].version)} · 구성 ${i+1} · ${subset[0].cards.length}개 카드 · ${subset.length}개 응답</option>`;}).join('');
 const old=cohortKeys.indexOf(previous);if(old>=0)$('cohort').value=String(old);
 $('workspace').hidden=!records.length;$('example-note').hidden=!example;
 render();
}
function render(){
 const key=cohortKeys[Number($('cohort').value)],filter=$('test-filter').value;
 active=records.filter(r=>r.cohort===key&&(filter==='all'||r.isTest===filter));
 const mean=active.length?(active.reduce((sum,r)=>sum+r.groups.length,0)/active.length).toFixed(1):'—';
 const clarity=active.map(r=>number(r.answers.label_comprehension)).filter(v=>v!==null);
 $('stats').innerHTML=[['응답 수',active.length],['평균 그룹 수',mean],['평균 명칭 이해도',clarity.length?(clarity.reduce((a,b)=>a+b,0)/clarity.length).toFixed(1)+'/5':'—'],['따로 둔 카드가 있는 응답',active.filter(r=>r.ungrouped.length).length]].map(([name,value])=>`<div class="stat"><span>${name}</span><strong>${value}</strong></div>`).join('');
 overview();
 $('person').innerHTML=active.map((r,i)=>`<option value="${i}">${esc(personLabel(r,i))}</option>`).join('');
 individual();
 if(tab==='matrix')matrix();
}
function personLabel(r,i){const who=$('personal').checked?r.pre?.participant:{};return `응답 ${i+1}${who?.name?' · '+who.name:''}${who?.student_number?' · '+who.student_number:''} · ${r.isTest==='test'?'시험':r.isTest==='live'?'실제':'구분 미기록'}`;}
function overview(){
 const cards=active[0]?.cards??[];
 for(const [id,key] of [['difficult-chart','difficult_cards'],['naming-chart','naming_difficult_cards']]){
  const ranking=cards.map(c=>({c,...difficultyStats(active,c.id,key)})).filter(x=>x.count).sort((a,b)=>b.count-a.count).slice(0,15);
  $(id).innerHTML=ranking.length?ranking.map(x=>bar(x.c.name,x.count,x.total)).join(''):'<p class="muted">선택된 카드가 없거나 해당 문항의 기록이 없습니다.</p>';
 }
 $('clarity-chart').innerHTML=[1,2,3,4,5].map(score=>bar(`${score}점`,active.filter(r=>number(r.answers.label_comprehension)===score).length,active.filter(r=>number(r.answers.label_comprehension)!==null).length)).join('');
 const eligible=active.filter(r=>Array.isArray(r.answers.grouping_criteria));
 const keys=[...new Set(eligible.flatMap(r=>r.answers.grouping_criteria))];
 $('criteria-chart').innerHTML=keys.length?keys.map(key=>bar(active.find(r=>r.p.questionnaire?.grouping_criteria?.[key])?.p.questionnaire.grouping_criteria[key]??labels[key]??key,eligible.filter(r=>r.answers.grouping_criteria.includes(key)).length,eligible.length)).join(''):'<p class="muted">기록된 분류 기준이 없습니다.</p>';
}
function namedReasons(item,dict){return [...arr(item.reasons).map(v=>dict?.[v]??v),...(item.other?[`기타: ${item.other}`]:[])].map(esc).join(' · ')||'이유 미기록';}
function individual(){
 const r=active[Number($('person').value)];
 if(!r){$('person-detail').innerHTML='<p class="muted">표시할 응답이 없습니다.</p>';return;}
 const byId=new Map(r.cards.map(c=>[c.id,c]));
 const chips=ids=>ids.map(id=>{const c=byId.get(id);return `<button class="chip" data-card-detail="${esc(id)}" aria-label="${esc(c?.name??id)} 설명 보기">${esc(c?.name??id)}</button>`;}).join('');
 const reasons=arr(r.answers.group_reasons);
 const groupHtml=r.groups.map(g=>{const reason=reasons.find(a=>String(a.group_id)===g.id)?.reason;return `<article class="group"><div class="group-heading"><h3>${esc(g.name)}</h3><span>${g.card_ids.length}개</span></div><div class="chips">${chips(g.card_ids)}</div>${reason?`<p class="reason">${esc(reason)}</p>`:''}</article>`;}).join('');
 const loose=r.ungrouped.length?`<article class="group loose"><div class="group-heading"><h3>따로 둔 카드</h3><span>${r.ungrouped.length}개</span></div><div class="chips">${chips(r.ungrouped)}</div></article>`:'';
 const a=r.pre?.answers,q=r.pre?.questionnaire;
 const pre=a?`<p>이용 빈도: ${esc(q?.frequency?.[a.portal_frequency]??a.portal_frequency??'미기록')} · 탐색 어려움 빈도: ${esc(a.navigation_difficulty_frequency??'미기록')}/5 · 탐색 용이성: ${esc(a.perceived_navigation_ease??'미기록')}/5</p>${arr(a.difficult_functions).map(f=>`<div class="answer-item"><strong>${esc(f.function_name)}</strong><p>${arr(f.difficulty_reasons?.selected).map(v=>esc(q?.reason_options?.[v]??v)).join(' · ')}${f.difficulty_reasons?.other?' · '+esc(f.difficulty_reasons.other):''}</p></div>`).join('')}`:`<p class="muted">${r.pre?.skipped?'사전 설문을 건너뛴 응답입니다.':'사전 설문이 포함되지 않았습니다.'}</p>`;
 const answerCards=(key,dict)=>arr(r.answers[key]).length?arr(r.answers[key]).map(a=>`<div class="answer-item"><strong>${esc(byId.get(a.card_id)?.name??a.card_id)}</strong><p>${namedReasons(a,dict)}</p><p>${esc(byId.get(a.card_id)?.description??'')}</p></div>`).join(''):`<p class="muted">${Array.isArray(r.answers[key])?'선택한 카드가 없습니다.':'문항 기록이 없습니다.'}</p>`;
 const date=r.p.submitted_at_client??r.raw.created_at;
 $('person-detail').innerHTML=`<h2>${esc(personLabel(r,Number($('person').value)))}</h2><p class="muted">제출 ID: ${esc(r.id||'미기록')}${date?' · '+esc(date):''}</p>${r.warning?`<p class="notice">${esc(r.warning)}</p>`:''}<div class="groups">${groupHtml}${loose}</div><div class="answer-block"><h2>사전 설문</h2>${pre}</div><div class="answer-block"><h2>분류가 어려웠던 카드와 이유</h2>${answerCards('difficult_cards',r.p.questionnaire?.sorting_reasons)}</div><div class="answer-block"><h2>명칭이 어려웠던 카드와 이유</h2>${answerCards('naming_difficult_cards',r.p.questionnaire?.naming_reasons)}</div><div class="answer-block"><h2>명칭 이해도와 분류 기준</h2><p>명칭 이해도: ${esc(number(r.answers.label_comprehension)??'미기록')}/5</p><p>${arr(r.answers.grouping_criteria).map(v=>esc(r.p.questionnaire?.grouping_criteria?.[v]??labels[v]??v)).join(' · ')||'분류 기준 미기록'}${r.answers.grouping_criterion_other?' · '+esc(r.answers.grouping_criterion_other):''}</p></div>`;
}
let matrixCards=[];
function matrix(){
 matrixCards=active[0]?.cards??[];
 const pairs=[];
 $('matrix-table').innerHTML=`<thead><tr><th scope="col">카드</th>${matrixCards.map(c=>`<th scope="col"><span>${esc(c.name)}</span></th>`).join('')}</tr></thead><tbody>${matrixCards.map((a,i)=>`<tr><th scope="row">${esc(a.name)}</th>${matrixCards.map((b,j)=>{
  if(i===j)return '<td class="empty" aria-label="같은 카드">·</td>';
  const s=pairStats(active,a.id,b.id);if(j>i&&s.together)pairs.push({a,b,...s});
  const value=s.rate===null?'—':Math.round(s.rate*100);
  return `<td${s.rate===null?' class="empty"':` style="background:rgb(${Math.round(35+s.rate*169)} ${Math.round(39+s.rate*193)} ${Math.round(29+s.rate*110)});color:${s.rate>.45?'#141b0b':'#f3f3ef'}"`}><button data-a="${i}" data-b="${j}" aria-label="${esc(a.name)}와 ${esc(b.name)}: ${s.together}/${s.eligible}${s.rate===null?' 집계 없음':', '+value+'%'}">${value}</button></td>`;
 }).join('')}</tr>`).join('')}</tbody>`;
 pairs.sort((a,b)=>b.rate-a.rate||b.eligible-a.eligible||b.together-a.together);
 $('pairs').innerHTML=pairs.length?pairs.slice(0,15).map(p=>`<div class="pair-row"><span>${esc(p.a.name)} ↔ ${esc(p.b.name)}</span><span>${Math.round(p.rate*100)}% · ${p.together}/${p.eligible}</span></div>`).join(''):'<p class="muted">함께 분류된 카드 쌍이 없습니다.</p>';
 $('pair-detail').textContent='표의 셀을 누르면 카드 이름과 실제 인원을 확인할 수 있습니다.';
}
async function importValues(sources){
 if(example){records=[];example=false;}
 const issues=[],known=new Map(records.map(r=>[r.id?'id:'+r.id:'body:'+JSON.stringify(r.raw),r]));let added=0,duplicates=0;
 for(const {name,value} of sources){
  let rows;try{rows=unpack(value);}catch(e){issues.push(`${name}: ${e.message}`);continue;}
  for(const [i,row]of rows.entries())try{
   const r=normalize(row),key=r.id?'id:'+r.id:'body:'+JSON.stringify(r.raw),prev=known.get(key);
   if(prev){duplicates++;if(JSON.stringify(prev.raw)!==JSON.stringify(r.raw))issues.push(`${name} ${i+1}번: 같은 UUID의 내용이 달라 먼저 불러온 응답을 유지했습니다.`);continue;}
   known.set(key,r);records.push(r);added++;if(r.warning)issues.push(`${name} ${i+1}번: ${r.warning}`);
  }catch(e){issues.push(`${name} ${i+1}번: ${e.message}`);}
 }
 status(`${added}개 추가 · 중복 ${duplicates}개 제외 · 총 ${records.length}개 응답`,issues);rebuild();
}
$('files').addEventListener('change',async e=>{const sources=[];for(const file of e.target.files)sources.push({name:file.name,value:await file.text()});await importValues(sources);e.target.value='';});
$('load-paste').addEventListener('click',()=>importValues([{name:'붙여넣기',value:$('paste').value}]));
$('clear').addEventListener('click',()=>{records=[];example=false;$('paste').value='';status('불러온 응답을 비웠습니다.');rebuild();});
for(const id of ['test-filter','cohort'])$(id).addEventListener('change',render);
$('person').addEventListener('change',individual);
$('personal').addEventListener('change',()=>{const index=$('person').value;$('person').innerHTML=active.map((r,i)=>`<option value="${i}">${esc(personLabel(r,i))}</option>`).join('');$('person').value=index;individual();});
document.querySelector('.tabs').addEventListener('click',e=>{const target=e.target.closest('[data-tab]');if(!target)return;tab=target.dataset.tab;for(const button of document.querySelectorAll('[data-tab]'))button.setAttribute('aria-pressed',String(button===target));for(const name of ['overview','individual','matrix'])$(name).hidden=name!==tab;if(tab==='matrix')matrix();});
$('matrix-table').addEventListener('click',e=>{const cell=e.target.closest('[data-a]');if(!cell)return;const a=matrixCards[Number(cell.dataset.a)],b=matrixCards[Number(cell.dataset.b)],s=pairStats(active,a.id,b.id);$('pair-detail').textContent=`${a.name} ↔ ${b.name}: ${s.rate===null?'집계 가능한 응답이 없습니다.':`${s.together}/${s.eligible}개 응답에서 함께 분류 (${Math.round(s.rate*100)}%)`}`;});
$('sample').addEventListener('click',()=>{
 records=[];example=true;$('paste').value='';document.querySelector('.import details').open=false;
 for(let i=0;i<3;i++){
  const ids=sampleCards.map(c=>c.id),groups=[{id:'g1',name:'학업과 수업',card_ids:ids.slice(0,12+i)},{id:'g2',name:'신청과 학교생활',card_ids:ids.slice(12+i,30)},{id:'g3',name:'생활·행정 서비스',card_ids:ids.slice(30,48)}];
  records.push(normalize({id:`example-${i+1}`,study_version:'예시 데이터',is_test:true,payload:{kind:'portal_post_sort_survey',cards:sampleCards,pre_survey:{skipped:true},sort_result:{groups,ungrouped_card_ids:ids.slice(48)},answers:{group_reasons:groups.map(g=>({group_id:g.id,reason:'화면을 살펴보기 위한 가상의 분류입니다.'})),difficult_cards:[{card_id:ids[i],reasons:['never_used']}],naming_difficult_cards:[{card_id:ids[2],reasons:['unfamiliar_term']}],label_comprehension:3+i%2,grouping_criteria:['similar_purpose']},questionnaire:{sorting_reasons:{never_used:'사용해 본 적이 없어서'},naming_reasons:{unfamiliar_term:'용어가 생소해서'}}}}));
 }
 status('가상의 예시 응답 3개를 표시합니다. 실제 연구 결과가 아닙니다.');rebuild();
});

$('person-detail').addEventListener('click',e=>{const button=e.target.closest('[data-card-detail]');if(!button)return;const r=active[Number($('person').value)],c=r?.cards.find(c=>c.id===button.dataset.cardDetail);if(!c)return;$('detail-name').textContent=c.name;$('detail-description').textContent=c.description||'기록된 설명이 없습니다.';$('card-dialog').showModal();});
