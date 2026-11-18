const demoRoot = new URL('../demo/', import.meta.url).pathname;
const officialRoot = new URL('../', import.meta.url).pathname;
const officialSteps = ['pre','intro','tutorial','cards','post-1','post-2','post-3'];
export const official = officialSteps.includes(location.pathname.slice(officialRoot.length).split('/')[0]);
const cleanRoot = official ? officialRoot : demoRoot;
export const cleanRoute = official || location.pathname.startsWith(demoRoot);
const routeStep = cleanRoute ? location.pathname.slice(cleanRoot.length).split('/')[0] : '';
export const practiceRoute = routeStep === 'tutorial' || new URLSearchParams(location.search).get('practice') === '1';
export const integrated = cleanRoute || new URLSearchParams(location.search).get('flow') === 'study';
export const storageKeys = {
 pre: official ? 'hyu-live-pre-v1' : 'hyu-study-50-pre',
 preDraft: official ? 'hyu-live-pre-draft-v1' : `hyu-portal-survey:portal-experience-survey-selected-50-v1${integrated ? ':study' : ''}`,
 post: official ? 'hyu-live-post-v1' : `hyu-post-sort-survey:portal-post-sort-survey-selected-50-v1${integrated ? ':study' : ''}`,
 sort: official ? 'hyu-live-sort-v1' : 'hyu-spatial-card-sort-selected-50-v1',
 practice: official ? 'hyu-live-practice-v1' : 'hyu-card-sort-selected-50-practice-v1',
 practiceDone: official ? 'hyu-live-practice-done-v1' : 'hyu-study-50-practice-done-required-v1',
 reached: official ? 'hyu-live-reached-v1' : 'hyu-study-50-reached',
};
export const sortStorage = () => official ? sessionStorage : localStorage;
// A completed official submission followed by the entry page starts a new participant.
if (official && routeStep === 'pre') {
 try { if (JSON.parse(sessionStorage.getItem(storageKeys.post) || 'null')?.done) Object.values(storageKeys).forEach(key => sessionStorage.removeItem(key)); } catch {}
}
export function resetFollowingPre() {
 if (!official) return;
 for (const key of ['post','sort','practice','practiceDone','reached']) sessionStorage.removeItem(storageKeys[key]);
 reached = 0;
}
export const urls = {intro:'../study-50/intro.html?flow=study&step=cards&v=official-12',pre:'../survey-50/?flow=study&step=pre&v=official-12',cards:'../canvas-50/?flow=study&step=cards&resume=post-survey&v=official-12', 'post-1':'../post-survey-50/?flow=study&step=post-1&stage=groups&v=official-12','post-3':'../post-survey-50/?flow=study&step=post-3&stage=questions&v=official-12','post-2':'../post-survey-50/?flow=study&step=post-2&stage=select&v=official-12'};
let practiceDone=false;try{practiceDone=sessionStorage.getItem(storageKeys.practiceDone)==='1';}catch{}
if(!practiceDone) urls.cards += '&practice=1';
if(cleanRoute) Object.assign(urls, {intro:cleanRoot+'intro/',pre:cleanRoot+'pre/',cards:cleanRoot+(practiceDone?'cards/':'tutorial/'),actual:cleanRoot+'cards/',tutorial:cleanRoot+'tutorial/','post-1':cleanRoot+'post-1/','post-2':cleanRoot+'post-2/','post-3':cleanRoot+'post-3/'});
const steps=['pre','cards','post-1','post-2','post-3'], labels=['사전 설문','카드 분류','사후 질문 1','사후 질문 2','사후 질문 3'];
let current=(cleanRoute ? (['tutorial','intro'].includes(routeStep)?'cards':routeStep) : new URLSearchParams(location.search).get('step'))||'pre', frozen=false;
let reached=0;try{reached=Number(sessionStorage.getItem(storageKeys.reached))||0;}catch{}
let nav;
function render(){if(!nav)return;reached=Math.max(reached,steps.indexOf(current));try{sessionStorage.setItem(storageKeys.reached,String(reached));}catch{}nav.innerHTML=steps.map((step,i)=>`<button type="button" data-study-step="${step}" ${step===current?'aria-current="step"':''} ${frozen||i>reached?'disabled':''}>${labels[i]}</button>`).join('<span aria-hidden="true">›</span>');}
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
