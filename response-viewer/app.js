import {has,object,recordsFrom,inspect,fields} from './data.js?v=inspection-2';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MISSING=Symbol('missing'),arr=v=>Array.isArray(v)?v:[],get=(o,k)=>has(o,k)?o[k]:MISSING;
let sources=[],entries=[],current=null;
function value(v){if(v===MISSING)return '항목 없음';if(v===null)return 'null';if(v==='')return '빈 문자열 ("")';if(v===true)return 'true';if(v===false)return 'false';return typeof v==='object'?JSON.stringify(v,null,2):String(v);}
function answer(v){return `<div class="answer-value">${esc(value(v))}</div>`;}
function dl(rows){return `<dl class="data-list">${rows.map(([name,v])=>`<dt>${esc(name)}</dt><dd>${esc(value(v))}</dd>`).join('')}</dl>`;}
function section(id,title,body){return `<section class="question" id="${id}"><div class="question-heading"><h2>${esc(title)}</h2></div>${body}</section>`;}
function entry(title,body){return `<div class="entry"><h3>${esc(title)}</h3>${body}</div>`;}
function options(selected,dict,{multiple=false}={}){
 const missing=selected===MISSING,items=multiple?arr(selected):[selected],map=object(dict),keys=[...new Set([...Object.keys(map),...items.filter(v=>v!==MISSING&&v!==null).map(String)])];
 if(!keys.length)return answer(selected);
 return `${missing?'<p class="muted">응답 항목 없음</p>':''}<div class="options read-only">${keys.map(key=>`<label class="choice"><input type="${multiple?'checkbox':'radio'}" disabled ${items.some(v=>String(v)===key)?'checked':''}><span>${esc(map[key]??key)}</span></label>`).join('')}</div>`;
}
function scale(selected,dict){const map=object(dict),keys=Object.keys(map);if(!keys.length)return answer(selected);return `<div class="scale read-only">${keys.map(key=>`<label class="scale-option"><input type="radio" disabled ${selected!==MISSING&&String(selected)===key?'checked':''}><span class="scale-number">${esc(key)}</span><span class="scale-label">${esc(map[key])}</span></label>`).join('')}</div><p class="selection-summary">저장된 응답: ${esc(value(selected))}</p>`;}
function consent(v){return `<p class="check-state">동의 여부: ${esc(value(v))}</p>`;}
function showPre(pre,preRow,p){
 if(!has(p,'pre_survey'))return '<p class="muted">사전 설문 항목이 없습니다.</p>';
 const a=object(pre.answers),q=object(pre.questionnaire),participant=object(pre.participant);
 return `${dl([['사전 설문 ID',get(preRow,'id')],['사전 설문 버전',get(preRow,'study_version')],['사전 설문 is_test',get(preRow,'is_test')],['건너뛰기',get(pre,'skipped')],['건너뛴 이유',get(pre,'reason')],['건너뛴 시각',get(pre,'skipped_at_client')],['사전 설문 시작',get(pre,'started_at')],['사전 설문 제출',get(pre,'submitted_at_client')]])}
 ${entry('01 기본정보',`<div class="identity-fields">${[['학번','student_number'],['학과','department'],['이름','name']].map(([label,key])=>`<div><span class="field-label">${label}</span>${answer(get(participant,key))}</div>`).join('')}</div>`)}
 ${entry('02 한양대학교 포털을 얼마나 자주 사용하나요?',options(get(a,'portal_frequency'),q.frequency))}
 ${entry('03 원하는 메뉴를 찾는 데 어려움을 겪은 경험이 있나요?',scale(get(a,'navigation_difficulty_frequency'),q.difficulty_scale))}
 ${entry('04 찾기 어려웠던 기능이 있었다면 무엇인가요?',`<p class="check-state">해당 없음으로 저장: ${esc(value(get(a,'functions_not_applicable')))}</p>${!has(a,'difficult_functions')?answer(MISSING):!arr(a.difficult_functions).length?answer(a.difficult_functions):arr(a.difficult_functions).map((f,i)=>`<div class="view-row"><h4>${i+1}. ${esc(value(get(f,'function_name')))}</h4>${dl([['입력 ID',get(f,'id')],['회상 상태',get(f,'recall_status')]])}<h4>찾기 어려웠던 이유</h4>${options(get(object(f.difficulty_reasons),'selected'),q.reason_options,{multiple:true})}<h4>기타 이유</h4>${answer(get(object(f.difficulty_reasons),'other'))}</div>`).join('')}`)}
 ${entry('05 현재 포털에서 원하는 기능을 쉽게 찾을 수 있다고 생각하나요?',scale(get(a,'perceived_navigation_ease'),q.ease_scale))}
 ${entry('정보 수집 및 응답 제출 동의',consent(get(pre,'consent')))}`;
}
function cardName(cards,id){return cards.find(c=>c.id===id)?.name??`목록에 없는 카드: ${id}`;}
function groupRender(g,i,cards,reasons){const members=arr(g.card_ids);return `<article class="group-surface tone-${Number.isInteger(g.tone)&&g.tone>=0&&g.tone<=3?g.tone:i%4}"><div class="group-heading"><h3>${esc(value(get(g,'name')))}</h3><span>${members.length}개</span></div>${members.map(id=>`<div class="group-item">${esc(cardName(cards,id))}<small>${esc(id)}</small></div>`).join('')}<div class="group-foot">${dl([['그룹 ID',get(g,'id')],['저장된 색상',get(g,'tone')],['추가 설명',reasons.find(r=>r.group_id===g.id)?.reason??MISSING]])}</div></article>`;}
function showSort(sort,cards,a){
 const groups=arr(sort.groups),singles=arr(sort.ungrouped_card_ids),all=[...groups.flatMap(g=>arr(g.card_ids)),...singles],known=new Set(cards.map(c=>c.id));
 const absent=cards.filter(c=>!all.includes(c.id)),duplicates=[...new Set(all.filter((id,i)=>all.indexOf(id)!==i))],unknown=all.filter(id=>!known.has(id));
 const check=absent.length||duplicates.length||unknown.length?`카드 누락 ${absent.length}개 · 중복 ${duplicates.length}개 · 알 수 없는 ID ${unknown.length}개`:`카드 ${cards.length}개가 각각 한 번씩 분류 결과에 포함되어 있습니다.`;
 return `<p class="storage-note">그룹 ${groups.length}개 · 그룹에 배치한 카드 ${groups.reduce((n,g)=>n+arr(g.card_ids).length,0)}개 · 따로 둔 카드 ${singles.length}개<br>${esc(check)}<br>아래 배치는 저장된 소속 관계를 보여줍니다. 원래 캔버스 위치를 재현한 화면은 아닙니다.</p>${dl([['결과 출처',get(sort,'source')],['최종 확정',get(sort,'confirmed')],['확정 시각',get(sort,'confirmed_at')]])}<div class="entry">${groups.map((g,i)=>groupRender(g,i,cards,arr(a.group_reasons))).join('')}${!has(sort,'groups')?answer(MISSING):!groups.length?answer(sort.groups):''}</div>${entry('따로 둔 카드',!has(sort,'ungrouped_card_ids')?answer(MISSING):singles.length?singles.map(id=>`<div class="answer-value">${esc(cardName(cards,id))} · ${esc(id)}</div>`).join(''):answer(sort.ungrouped_card_ids))}${absent.length?entry('소속 정보가 없는 카드',answer(absent.map(c=>c.id))):''}${duplicates.length?entry('중복된 카드 ID',answer(duplicates)):''}${unknown.length?entry('카드 목록에 없는 ID',answer(unknown)):''}`;
}
function showPost(p,cards){const a=object(p.answers),q=object(p.questionnaire);
 const selected=(key,none,reasonDict)=>`<p class="check-state">없음으로 저장: ${esc(value(get(a,none)))}</p>${!has(a,key)?answer(MISSING):!arr(a[key]).length?answer(a[key]):arr(a[key]).map(item=>`<div class="view-row"><h4>${esc(cardName(cards,item.card_id))}</h4>${dl([['카드 ID',get(item,'card_id')]])}${options(get(item,'reasons'),q[reasonDict],{multiple:true})}<h4>기타 이유</h4>${answer(get(item,'other'))}</div>`).join('')}`;
 return `${entry('사후 질문 1 · 그룹 이름과 추가 설명',!has(a,'group_reasons')?answer(MISSING):arr(a.group_reasons).length?arr(a.group_reasons).map((r,i)=>`<div class="view-row"><h4>${i+1}. ${esc(value(get(r,'group_name')))}</h4>${dl([['그룹 ID',get(r,'group_id')],['카드 목록',get(r,'card_ids')]])}<h4>추가 설명</h4>${answer(get(r,'reason'))}</div>`).join(''):answer(a.group_reasons))}
 ${entry('사후 질문 2 · 분류가 어려웠던 메뉴',selected('difficult_cards','difficult_none','sorting_reasons'))}
 ${entry('사후 질문 2 · 명칭을 이해하기 어려웠던 메뉴',selected('naming_difficult_cards','naming_none','naming_reasons'))}
 ${entry('사후 질문 3 · 카드에 적힌 명칭만으로 기능을 이해할 수 있었나요?',scale(get(a,'label_comprehension'),q.label_comprehension_scale))}
 ${entry('사후 질문 3 · 기능을 그룹으로 묶을 때 어떤 기준을 고려했나요?',`${options(get(a,'grouping_criteria'),q.grouping_criteria,{multiple:true})}<h4>기타 기준</h4>${answer(get(a,'grouping_criterion_other'))}`)}
 ${entry('응답 제출 동의',consent(get(p,'consent')))}`;
}
function showViews(sort,cards){const views=object(sort.description_views),keys=Object.keys(views);return `<p class="storage-note">설명 열람 기록 ${keys.length}개 카드. 기록이 없는 카드는 열람 횟수 0회로 단정하지 않습니다.</p>${!has(sort,'description_views')?answer(MISSING):!keys.length?answer(sort.description_views):keys.map(id=>{const v=object(views[id]);return `<article class="view-row"><h3>${esc(cardName(cards,id))}</h3>${dl([['카드 ID',id],['열람 횟수',get(v,'count')],['최초 열람 시각',get(v,'firstViewedAt')],['최종 열람 시각',get(v,'lastViewedAt')],['설명 버전',get(v,'descriptionVersion')]])}</article>`;}).join('')}`;}
function showCards(cards,sort){const groups=arr(sort.groups),views=object(sort.description_views);return cards.length?cards.map((c,i)=>`<article class="card-source"><h3>${i+1}. ${esc(value(get(c,'name')))}</h3>${dl([['카드 ID',get(c,'id')],['최종 소속',groups.find(g=>arr(g.card_ids).includes(c.id))?.name??(arr(sort.ungrouped_card_ids).includes(c.id)?'따로 둔 카드':'소속 정보 없음')],['설명 열람 기록',has(views,c.id)?'기록 있음':'기록 없음']])}<h4>제출 시점에 저장된 기능 설명</h4>${answer(get(c,'description'))}</article>`).join(''):answer(cards);}
function render(){
 current=entries[Number($('record').value)];if(!current)return;
 const {source,value:raw,path}=current,{row,payload:p,preRow,pre}=inspect(raw),sort=object(p.sort_result),cards=arr(p.cards),a=object(p.answers);
 const meta=dl([['불러온 파일',source.name],['선택한 응답 경로',path],['최종 제출 UUID',get(row,'id')],['최상위 is_test',get(row,'is_test')],['실험 버전',get(row,'study_version')],['DB 생성 시각',get(row,'created_at')],['응답 종류',get(p,'kind')],['저장 형식 버전',get(p,'schema_version')],['실험 모드',get(p,'study_mode')],['진행 흐름',get(p,'workflow')],['응답 시작 시각',get(p,'started_at')],['최종 제출 시각',get(p,'submitted_at_client')],['최종 동의',get(p,'consent')]]);
 const note=`<p class="storage-note">이 화면은 불러온 JSON을 그대로 검토합니다. ${!has(row,'payload')?'payload 내용만 불러왔다면 최종 제출 UUID·is_test·DB 생성 시각 등 행 바깥 정보는 확인할 수 없습니다. 사전 설문 ID를 최종 제출 ID로 대신 사용하지 않습니다.':''}<br>저장되지 않은 행동은 재생할 수 없습니다. 현재 제출 형식은 최종 그룹과 설명 열람 요약을 담으며, 카드 이동 경로·되돌리기 이력·튜토리얼 조작 과정·설명 열람의 매회 시각은 담지 않습니다.</p>`;
 $('report').innerHTML=section('meta','저장 정보',note+meta)+section('pre','사전 설문',showPre(pre,preRow,p))+section('sort','카드 분류 · 최종 그룹',showSort(sort,cards,a))+section('post','사후 질문',showPost(p,cards))+section('views','카드 설명 열람 기록',showViews(sort,cards))+section('cards','제출 당시 카드 목록과 설명',showCards(cards,sort));
 const tree=fields(source.root);
 $('coverage').textContent=`원본 파일의 ${tree.length}개 항목을 모두 표시합니다. 객체·배열도 각각 한 항목으로 포함합니다.`;
 $('field-tree').innerHTML=tree.map(f=>`<div class="field-row${f.container?' field-container':''}" data-field-path="${esc(f.path)}"><span class="field-path">${esc(f.path)}</span><span class="field-type">${f.type}</span><span class="field-value">${esc(f.container?Array.isArray(f.value)?`배열 · ${f.value.length}개 항목${f.value.length?'':' []'}`:`객체 · ${Object.keys(f.value).length}개 필드${Object.keys(f.value).length?'':' {}'}`:JSON.stringify(f.value))}</span></div>`).join('');
 $('raw-json').textContent=source.text;
}
function rebuild(){entries=sources.flatMap(source=>recordsFrom(source.root).map(r=>({...r,source})));$('workspace').hidden=!entries.length;$('record').innerHTML=entries.map((r,i)=>{const {pre}=inspect(r.value),person=object(pre.participant);return `<option value="${i}">${esc(r.source.name)} · ${r.path}${person.name?' · '+esc(person.name):''}</option>`;}).join('');if(entries.length)render();}
function load(inputs){const errors=[];let added=0;for(const input of inputs){try{const root=JSON.parse(input.text);sources.push({...input,root});added++;}catch(e){errors.push(`${input.name}: JSON을 읽지 못했습니다. ${e.message}`);}}$('status').textContent=`${added}개 파일 추가 · 총 ${sources.length}개 파일`;$('errors').textContent=errors.join('\n');rebuild();}
$('load-paste').addEventListener('click',()=>load([{name:`붙여넣은 응답 ${sources.length+1}`,text:$('paste').value}]));
$('files').addEventListener('change',async e=>{const results=await Promise.allSettled([...e.target.files].map(async file=>({name:file.name,text:await file.text()})));const errors=results.filter(r=>r.status==='rejected');load(results.filter(r=>r.status==='fulfilled').map(r=>r.value));if(errors.length)$('errors').textContent+='\n일부 파일을 읽지 못했습니다.';e.target.value='';});
$('record').addEventListener('change',render);
$('clear').addEventListener('click',()=>{sources=[];entries=[];current=null;$('paste').value='';$('report').replaceChildren();$('field-tree').replaceChildren();$('raw-json').textContent='';$('workspace').hidden=true;$('status').textContent='불러온 내용을 비웠습니다.';$('errors').textContent='';});
$('download').addEventListener('click',()=>{if(!current)return;const url=URL.createObjectURL(new Blob([current.source.text],{type:'application/json;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=current.source.name.endsWith('.json')?current.source.name:'response-original.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
$('print').addEventListener('click',()=>window.print());
