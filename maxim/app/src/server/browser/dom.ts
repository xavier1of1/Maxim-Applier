// Trusted static scripts only. Page/model text is never interpolated into executable code.
export const controlsScript=`JSON.stringify(Array.from(document.querySelectorAll('input,textarea,select')).slice(0,100).map((e,index)=>{
 const tag=e.tagName.toLowerCase(),type=(e.getAttribute('type')||(tag==='input'?'text':tag)).toLowerCase();
 const id=e.getAttribute('data-maxim-field')||crypto.randomUUID();e.setAttribute('data-maxim-field',id);
 return {id,index,tag,type,name:e.name||'',label:(Array.from(e.labels||[]).map(l=>l.textContent||'').join(' ')||e.getAttribute('aria-label')||e.getAttribute('placeholder')||e.name||'Unlabeled field').trim().slice(0,2000),required:!!e.required,disabled:!!e.disabled,visible:e.getClientRects().length>0,value:type==='checkbox'||type==='radio'?e.checked:e.value,options:tag==='select'?Array.from(e.options).slice(0,100).map(o=>({value:o.value,label:o.text.slice(0,200)})):[]};
}))`;
export const guardScript=`(()=>{
 const originalSubmit=HTMLFormElement.prototype.submit,originalRequest=HTMLFormElement.prototype.requestSubmit;
 const prevent=e=>{if(e.type==='submit'||e.type==='keydown'&&e.key==='Enter'||e.type==='click'&&e.target?.closest?.('button:not([type]),button[type=submit],input[type=submit],input[type=image]')){e.preventDefault();e.stopImmediatePropagation();}};
 for(const name of ['submit','keydown','click'])document.addEventListener(name,prevent,true);
 HTMLFormElement.prototype.submit=()=>{throw Error('Manual handoff required');};
 HTMLFormElement.prototype.requestSubmit=()=>{throw Error('Manual handoff required');};
 Object.defineProperty(window,'__maximReleaseForManualReview',{configurable:true,value:()=>{for(const name of ['submit','keydown','click'])document.removeEventListener(name,prevent,true);HTMLFormElement.prototype.submit=originalSubmit;HTMLFormElement.prototype.requestSubmit=originalRequest;}});
})()`;
export const releaseScript=`window.__maximReleaseForManualReview?.();true`;
