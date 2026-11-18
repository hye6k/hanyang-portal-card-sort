import {integrated,cleanRoute,practiceRoute,urls} from '../study-50/flow.js?v=verified-descriptions-10';
const practice=practiceRoute;
const actual=new URL(cleanRoute?urls.actual:location.href,location.origin);
if(!cleanRoute){actual.searchParams.delete('practice');actual.searchParams.set('resume','post-survey');actual.searchParams.set('v','verified-descriptions-10');}
const training=new URL(cleanRoute?urls.tutorial:actual,location.origin);if(!cleanRoute)training.searchParams.set('practice','1');
const css=document.createElement('link');css.rel='stylesheet';css.href='../study/tutorial.css?v=verified-descriptions-10';document.head.append(css);
if(!practice){
 const help=document.createElement('button');help.className='practice-help';help.textContent='사용 방법';help.addEventListener('click',()=>location.assign(training));document.body.append(help);
}else{
 document.body.classList.add('practice-mode');
 const steps=[
  {title:'화면을 움직여 보세요',text:'빈 배경을 끌어 이동하고, 화면을 확대·축소해 보세요.',tasks:[[['pan'],'빈 배경을 끌어 이동하기'],[['zoom'],'두 손가락 또는 마우스 휠로 확대·축소하기'],[['fit'],'하단의 전체 보기로 돌아오기 (선택)']],tip:'카드 위를 끌면 카드가 움직입니다. 화면 이동은 빈 배경에서 시작하세요. PC에서는 휠 버튼을 누른 채 끌어도 이동할 수 있습니다.',focus:['fit']},
  {title:'카드를 눌러 확인해 보세요',text:'연필 카드를 짧게 눌러 설명을 읽고, 이 카드로 그룹을 만들어 보세요.',tasks:[[['description'],'카드를 눌러 설명 확인하기'],[['singleton'],'이 카드로 그룹 만들기 → 이름 입력 → 만들기']],tip:'한 장만으로도 그룹을 만들 수 있습니다. 임시 이름으로 만들 수도 있지만, 최종 완료 전에는 그룹 이름을 작성해야 합니다.',focus:[]},
  {title:'카드를 합치고 빼보세요',text:'사과를 바나나 가까이에 놓아 묶은 뒤, 한 장을 빈 곳으로 끌어내 보세요.',tasks:[[['merge'],'카드를 다른 카드나 그룹 가까이에 놓기'],[['split'],'그룹 속 카드 한 장을 밖으로 끌어내기'],[['undo','redo'],'하단 화살표로 실행 취소하고 다시 실행하기 (선택)']],tip:'합쳐질 카드들이 공통 윤곽으로 표시되면 손을 놓으세요.',focus:['undo','redo']},
  {title:'그룹을 옮기고 수정해 보세요',text:'그룹 속 카드를 0.5초 꾹 눌러 함께 옮긴 뒤, 짧게 눌러 편집해 보세요.',tasks:[[['group_move'],'0.5초 꾹 누른 채 끌어 그룹 전체 이동하기'],[['rename'],'카드 짧게 누르기 → 소속 그룹 이름 변경'],[['detach'],'카드 짧게 누르기 → 이 카드를 그룹에서 빼기 (선택)']],tip:'마지막에 그룹 확인을 열어 이름과 소속을 점검하세요. 그룹이 없다면 사과와 바나나를 다시 묶어 보세요.',focus:['review']}
 ];
 const panel=document.createElement('section');panel.className='practice-guide';panel.setAttribute('aria-label','카드 분류 조작 연습');document.body.append(panel);
 let index=0;const completed=new Set();
 const required=[['pan','zoom'],['description','singleton'],['merge','split'],['group_move','rename']];
 const ready=step=>required[step].every(action=>completed.has(action));
 const allReady=()=>required.every((_,step)=>ready(step));
 const details=document.querySelector('#card-detail');
 function updateChecks(){panel.querySelectorAll('[data-practice-task]').forEach(el=>{const task=steps[index].tasks[Number(el.dataset.practiceTask)];const done=task[0].every(action=>completed.has(action));el.classList.toggle('is-done',done);el.querySelector('[data-task-mark]').textContent=done?'✓':'○';el.querySelector('[data-task-mark]').setAttribute('aria-label',done?'완료':'미완료');}); const next=panel.querySelector('[data-practice=next]');if(next)next.disabled=!ready(index);document.querySelector('[data-action=review]').disabled=!allReady();}
 function updateDetail(){
 const top=integrated?61:12;
 document.body.style.setProperty('--practice-detail-top',`${top}px`);
 document.body.style.setProperty('--practice-detail-height',`${Math.max(70,panel.getBoundingClientRect().top-top-12)}px`);
 document.body.classList.toggle('practice-detail-open',!details.hidden);
 }
 new ResizeObserver(updateDetail).observe(panel);
 window.addEventListener('resize',updateDetail);
 function render(){panel.innerHTML=`<div class="practice-guide-heading"><span>조작 연습 ${index+1} / ${steps.length}</span></div><h2>${steps[index].title}</h2><p>${steps[index].text}</p><ul class="practice-tasks">${steps[index].tasks.map((task,i)=>`<li data-practice-task="${i}"><span data-task-mark></span><span>${task[1]}</span></li>`).join('')}</ul><p class="practice-tip">${steps[index].tip}</p><p class="practice-tip">선택 항목을 제외한 조작을 완료하면 다음으로 넘어갈 수 있습니다.</p><div class="practice-guide-actions"><button type="button" data-practice="back" ${index===0?'disabled':''}>이전</button><button type="button" data-practice="next">${index===steps.length-1?'그룹 확인하기':'다음'}</button></div>`;
 document.querySelectorAll('.practice-target').forEach(el=>el.classList.remove('practice-target'));for(const action of steps[index].focus)document.querySelector(`[data-action="${action}"]`)?.classList.add('practice-target');if(index===1)document.querySelector('[data-id="card-3"]')?.classList.add('practice-target');updateChecks();updateDetail();if(index>0)document.querySelector('[data-action=fit]').click();}
 panel.addEventListener('click',e=>{const action=e.target.dataset.practice;if(!action)return;document.querySelector('#close-card-detail').click();if(action==='back'&&index>0){index--;render();}if(action==='next'&&ready(index)){if(index<steps.length-1){index++;render();}else document.querySelector('[data-action=review]').click();}});
 window.addEventListener('practice-action',e=>{completed.add(e.detail);updateChecks();});
 new MutationObserver(updateDetail).observe(details,{attributes:true,attributeFilter:['hidden'],subtree:true});
 const end=document.createElement('dialog');end.className='practice-end';end.innerHTML='<h2>연습을 마쳤습니다.</h2><p>실제 카드로 자유롭게 분류해 보세요.<br>사용 방법은 분류 중에도 다시 열 수 있습니다.</p><div><button type="button" data-practice="restart">튜토리얼 다시 하기</button><button type="button" data-practice="understood">이해했어요!</button></div>';document.body.append(end);
 function restart(){document.querySelector('[data-action=reset-test]').click();completed.clear();index=0;render();}
 window.addEventListener('practice-before-confirm',event=>{if(!allReady())event.preventDefault();});
 window.addEventListener('practice-finished',()=>{if(allReady())end.showModal();});end.addEventListener('cancel',e=>e.preventDefault());end.addEventListener('click',e=>{const action=e.target.dataset.practice;if(action==='restart'){end.close();restart();}if(action==='understood'&&allReady()){if(integrated)sessionStorage.setItem('hyu-study-50-practice-done-required-v1','1');location.assign(actual);}});
 render();restart();
}
