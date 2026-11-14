import {integrated} from './flow.js?v=journey-2';
const practice=new URLSearchParams(location.search).get('practice')==='1';
const actual=new URL(location.href);actual.searchParams.delete('practice');actual.searchParams.set('resume','post-survey');actual.searchParams.set('v','journey-2');
const training=new URL(actual);training.searchParams.set('practice','1');
const css=document.createElement('link');css.rel='stylesheet';css.href='../study/tutorial.css?v=journey-2';document.head.append(css);
if(!practice){const help=document.createElement('button');help.className='practice-help';help.textContent='사용 방법';help.addEventListener('click',()=>location.assign(training));document.body.append(help);}
else{
 document.body.classList.add('practice-mode');
 const panel=document.createElement('section');panel.className='practice-guide';panel.setAttribute('aria-label','카드 분류 조작 연습');document.body.append(panel);
 const steps=[['화면을 움직여 보세요','빈 배경을 끌어 이동해 보세요. 휴대전화는 두 손가락으로, PC는 마우스 휠로 확대·축소합니다.','전체 보기를 누르면 모든 카드가 보이는 화면으로 돌아옵니다.'],['카드를 합쳤다가 빼보세요','사과를 바나나 가까이에 놓아 그룹을 만들고, 한 장을 빈 곳으로 빼보세요. 그룹에 카드를 추가할 때도 같은 방법입니다.','하단의 말린 화살표로 실행 취소와 다시 실행을 해보세요.'],['그룹을 옮기고 설명을 열어보세요','그룹 속 카드 하나를 0.5초 꾹 누른 뒤 끌면 그룹 전체가 움직입니다. 카드를 한 번 누르면 설명을 볼 수 있습니다.','따로 있는 카드의 설명창에서는 한 장짜리 그룹도 만들 수 있습니다. 마지막에 그룹 확인을 열어 이름과 소속을 살펴보세요.']];
 let index=0;function render(){panel.innerHTML=`<div class="practice-guide-heading"><span>조작 연습 ${index+1} / 3</span><span>연습 내용은 응답에 포함되지 않습니다.</span></div><h2>${steps[index][0]}</h2><p>${steps[index][1]}</p><p class="practice-tip">${steps[index][2]}</p><div class="practice-guide-actions"><button type="button" data-practice="back" ${index===0?'disabled':''}>이전</button><button type="button" data-practice="next">${index===2?'그룹 확인하기':'다음'}</button></div>`;}
 panel.addEventListener('click',e=>{const action=e.target.dataset.practice;if(action==='back'&&index>0){index--;render();}if(action==='next'){if(index<2){index++;render();}else document.querySelector('[data-action=review]').click();}});render();
 const end=document.createElement('dialog');end.className='practice-end';end.innerHTML='<h2>연습을 마쳤습니다.</h2><p>실제 카드로 자유롭게 분류해 보세요.<br>사용 방법은 분류 중에도 다시 열 수 있습니다.</p><div><button type="button" data-practice="restart">튜토리얼 다시 하기</button><button type="button" data-practice="understood">이해했어요!</button></div>';document.body.append(end);
 window.addEventListener('practice-finished',()=>end.showModal());end.addEventListener('cancel',e=>e.preventDefault());end.addEventListener('click',e=>{const action=e.target.dataset.practice;if(action==='restart'){end.close();document.querySelector('[data-action=reset-test]').click();index=0;render();}if(action==='understood'){if(integrated)sessionStorage.setItem('hyu-study-practice-done','1');location.assign(actual);}});
}
