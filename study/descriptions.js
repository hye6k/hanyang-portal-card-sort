export function installDescriptions(cards) {
 const byId=new Map(cards.map(card=>[card.id,card]));
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const style=document.createElement('link');style.rel='stylesheet';style.href='../study/descriptions.css?v=usability-2';document.head.append(style);
 const dialog=document.createElement('dialog');dialog.className='function-description';dialog.setAttribute('aria-labelledby','function-description-title');
 dialog.innerHTML='<button type="button" class="description-close" aria-label="설명 닫기">×</button><h2 id="function-description-title"></h2><p></p>';document.body.append(dialog);
 let trigger;
 const close=()=>{dialog.close();trigger?.focus({preventScroll:true});};
 dialog.querySelector('button').addEventListener('click',close);
 dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}});
 document.addEventListener('click',event=>{const button=event.target.closest('[data-description]');if(!button)return;const card=byId.get(button.dataset.description);if(!card)return;trigger=button;dialog.querySelector('h2').textContent=card.name;dialog.querySelector('p').textContent=card.description;dialog.showModal();});
 return id=>`<button type="button" class="function-description-button" data-description="${esc(id)}" aria-label="${esc(byId.get(id)?.name)} 기능 설명 보기">설명</button>`;
}
