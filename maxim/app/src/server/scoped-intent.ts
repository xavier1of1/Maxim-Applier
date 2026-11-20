// Context can supply the target ID, never the user's verb or consent.
export function scopedIntent(message:unknown,quote:string,targetId:string,contextMatches:boolean,action:'evaluate'|'fill'){
 if(typeof message!=='string'||message.trim()!==quote.trim())return false;
 const request=message.trim().toLowerCase().replace(/[.!?]+$/,'').replace(/\s+/g,' ')
  .replace(/^(?:please |(?:can|could|would) you (?:please )?)/,'').replace(/,? please$/,'');
 const id=targetId.toLowerCase();
 if(action==='evaluate'){
  const match=/^(?:evaluate|assess) (.+?)(?: with career-ops)?$/.exec(request);
  return Boolean(match&&(match[1]===id||contextMatches&&['this role','this job','this opening'].includes(match[1])));
 }
 const match=/^fill (.+?)(?: (?:in|for|on) (.+))?$/.exec(request);
 if(!match)return false;
 if(match[1]===id&&!match[2])return true;
 if(!/^(?:(?:the )?approved (?:application )?fields(?: and (?:the )?(?:pdf|resume))?|(?:this|the) (?:form|application))$/.test(match[1]))return false;
 return match[2]===id||contextMatches&&(!match[2]||['this role','this application','this session'].includes(match[2]));
}
