import {integrated} from './flow.js?v=journey-3';
const practice=new URLSearchParams(location.search).get('practice')==='1';
const actual=new URL(location.href);actual.searchParams.delete('practice');actual.searchParams.set('resume','post-survey');actual.searchParams.set('v','journey-3');
const training=new URL(actual);training.searchParams.set('practice','1');
const css=document.createElement('link');css.rel='stylesheet';css.href='../study/tutorial.css?v=journey-3';document.head.append(css);
if(!practice){const help=document.createElement('button');help.className='practice-help';help.textContent='사용 방법';help.addEventListener('click',()=>location.assign(training));document.body.append(help);}
else{
 document.body.classList.add('practice-mode');
 const panel=document.createElement('section');panel.className='practice-guide';panel.setAttribute('aria-label','카드 분류 조작 연습');document.body.append(panel);
 const steps=[
 ['화면을 움직여 보세요','빈 배경을 끌어 이동해 보세요. 휴대전화는 두 손가락으로, PC는 마우스 휠로 확대·축소합니다.','전체 보기를 누르면 모든 카드가 보이는 화면으로 돌아옵니다.'],
 ['카드를 눌러 보세요','연필 카드를 한 번 눌러 설명을 확인해 보세요. 이 카드만으로 그룹을 만들려면 설명창의 ‘이 카드로 그룹 만들기’를 누르면 됩니다.','그룹 이름을 입력하고 만들기를 눌러 보세요. 이름을 비워 두어도 임시 이름이 붙습니다.'],
 ['카드를 옮겨 그룹을 만들어 보세요','사과를 바나나 가까이에 놓아 그룹을 만들고, 한 장을 빈 곳으로 빼보세요. 기존 그룹에 카드를 추가할 때도 같은 방법입니다.','하단의 말린 화살표로 실행 취소와 다시 실행을 해보세요.'],
 ['그룹 전체를 옮겨 보세요','그룹 속 카드 하나를 0.5초 꾹 누른 뒤 끌어 보세요. 카드 한 장 대신 그룹 전체가 함께 움직입니다.','그룹 확인을 열어 그룹 이름과 소속 카드를 살펴보고 완료를 눌러 주세요.']
 ];
 let index=0;function render(){panel.innerHTML=`<div class="practice-guide-heading"><span>조작 연습 ${index+1} / ${steps.length}</span><span>연습 내용은 응답에 포함되지 않습니다.</span></div><h2>${steps[index][0]}</h2><p>${steps[index][1]}</p><p class="practice-tip">${steps[index][2]}</p><div class="practice-guide-actions"><button type="button" data-practice="back" ${index===0?'disabled':''}>이전</button><button type="button" data-practice="next">${index===steps.length-1?'그룹 확인하기':'다음'}</button></div>`;}
 panel.addEventListener('click',e=>{const action=e.target.dataset.practice;if(action==='back'&&index>0){index--;render();}if(action==='next'){if(index<steps.length-1){index++;render();}else document.querySelector('[data-action=review]').click();}});render();
 const end=document.createElement('dialog');end.className='practice-end';end.innerHTML='<h2>연습을 마쳤습니다.</h2><p>실제 카드로 자유롭게 분류해 보세요.<br>사용 방법은 분류 중에도 다시 열 수 있습니다.</p><div><button type="button" data-practice="restart">튜토리얼 다시 하기</button><button type="button" data-practice="understood">이해했어요!</button></div>';document.body.append(end);
 window.addEventListener('practice-finished',()=>end.showModal());end.addEventListener('cancel',e=>e.preventDefault());end.addEventListener('click',e=>{const action=e.target.dataset.practice;if(action==='restart'){end.close();document.querySelector('[data-action=reset-test]').click();index=0;render();}if(action==='understood'){if(integrated)sessionStorage.setItem('hyu-study-practice-done','1');location.assign(actual);}});
}
