const demoRoot = new URL('../demo/', import.meta.url).pathname;
export const cleanRoute = location.pathname.startsWith(demoRoot);
const routeStep = cleanRoute ? location.pathname.slice(demoRoot.length).split('/')[0] : '';
export const practiceRoute = routeStep === 'tutorial' || new URLSearchParams(location.search).get('practice') === '1';
export const integrated = cleanRoute || new URLSearchParams(location.search).get('flow') === 'study';
export const urls = {pre:'../survey-50/?flow=study&step=pre&v=clean-routes-8',cards:'../canvas-50/?flow=study&step=cards&resume=post-survey&v=clean-routes-8', 'post-1':'../post-survey-50/?flow=study&step=post-1&stage=groups&v=clean-routes-8','post-3':'../post-survey-50/?flow=study&step=post-3&stage=questions&v=clean-routes-8','post-2':'../post-survey-50/?flow=study&step=post-2&stage=select&v=clean-routes-8'};
let practiceDone=false;try{practiceDone=sessionStorage.getItem('hyu-study-50-practice-done-required-v1')==='1';}catch{}
if(!practiceDone) urls.cards += '&practice=1';
if(cleanRoute) Object.assign(urls, {pre:demoRoot+'pre/',cards:demoRoot+(practiceDone?'cards/':'tutorial/'),actual:demoRoot+'cards/',tutorial:demoRoot+'tutorial/','post-1':demoRoot+'post-1/','post-2':demoRoot+'post-2/','post-3':demoRoot+'post-3/'});
const steps=['pre','cards','post-1','post-2','post-3'], labels=['사전 설문','카드 분류','사후 질문 1','사후 질문 2','사후 질문 3'];
let current=(cleanRoute ? (routeStep==='tutorial'?'cards':routeStep) : new URLSearchParams(location.search).get('step'))||'pre', frozen=false;
let reached=0;try{reached=Number(sessionStorage.getItem('hyu-study-50-reached'))||0;}catch{}
let nav;
function render(){if(!nav)return;reached=Math.max(reached,steps.indexOf(current));try{sessionStorage.setItem('hyu-study-50-reached',String(reached));}catch{}nav.innerHTML=steps.map((step,i)=>`<button type="button" data-study-step="${step}" ${step===current?'aria-current="step"':''} ${frozen||i>reached?'disabled':''}>${labels[i]}</button>`).join('<span aria-hidden="true">›</span>');}
export function updateFlow(step,locked=false){if(!integrated)return;current=step;frozen=locked;render();}
if(integrated){
 const css=document.createElement('link');css.rel='stylesheet';css.href='../study/flow.css?v=usability-2';document.head.append(css);
 document.body.classList.add('study-flow');nav=document.createElement('nav');nav.className='study-navigation';nav.setAttribute('aria-label','연구 진행 단계');
 document.body.prepend(nav);if(!document.querySelector('.page-heading'))document.body.classList.add('study-canvas');
 nav.addEventListener('click',e=>{const button=e.target.closest('[data-study-step]');if(!button||button.disabled||button.dataset.studyStep===current)return;const step=button.dataset.studyStep;
 if(document.querySelector('#post-form')&&step.startsWith('post-')){window.dispatchEvent(new CustomEvent('study-stage',{detail:({'post-1':'groups','post-2':'select','post-3':'questions'})[step]}));return;}
 if(document.querySelector('#survey-form')){document.querySelector('#survey-form').dataset.destination=urls[step];document.querySelector('#survey-form').requestSubmit();return;}
 location.assign(urls[step]);});render();
}
