export const integrated = new URLSearchParams(location.search).get('flow') === 'study';
export const urls = {pre:'../survey/?flow=study&step=pre&v=journey-1',cards:'../canvas-snap-collision/?flow=study&step=cards&resume=post-survey&v=journey-1', 'post-1':'../post-survey/?flow=study&step=post-1&stage=select&v=journey-1','post-2':'../post-survey/?flow=study&step=post-2&stage=questions&v=journey-1'};
const steps=['pre','cards','post-1','post-2'], labels=['사전 설문','카드 분류','사후 질문 1','사후 질문 2'];
let current=new URLSearchParams(location.search).get('step')||'pre', frozen=false;
let reached=0;try{reached=Number(sessionStorage.getItem('hyu-study-reached'))||0;}catch{}
let nav;
function render(){if(!nav)return;reached=Math.max(reached,steps.indexOf(current));try{sessionStorage.setItem('hyu-study-reached',String(reached));}catch{}nav.innerHTML=steps.map((step,i)=>`<button type="button" data-study-step="${step}" ${step===current?'aria-current="step"':''} ${frozen||i>reached?'disabled':''}>${labels[i]}</button>`).join('<span aria-hidden="true">›</span>');}
export function updateFlow(step,locked=false){if(!integrated)return;current=step;frozen=locked;render();}
if(integrated){
 const css=document.createElement('link');css.rel='stylesheet';css.href='../study/flow.css?v=journey-1';document.head.append(css);
 document.body.classList.add('study-flow');nav=document.createElement('nav');nav.className='study-navigation';nav.setAttribute('aria-label','연구 진행 단계');
 const heading=document.querySelector('.page-heading');if(heading)heading.prepend(nav);else{document.body.classList.add('study-canvas');document.body.prepend(nav);}
 nav.addEventListener('click',e=>{const button=e.target.closest('[data-study-step]');if(!button||button.disabled||button.dataset.studyStep===current)return;const step=button.dataset.studyStep;
 if(location.pathname.includes('/post-survey/')&&step.startsWith('post-')){document.querySelector(step==='post-1'?'#back-selection':'#next-questions').click();return;}
 if(location.pathname.includes('/survey/')){document.querySelector('#survey-form').dataset.destination=urls[step];document.querySelector('#survey-form').requestSubmit();return;}
 location.assign(urls[step]);});render();
}
