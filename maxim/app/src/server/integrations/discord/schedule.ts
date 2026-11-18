import {invariant} from '../../errors';
import type {ScheduleSpec} from './types';

const day = 86400000;
const intervals = {application_review:1,weekly_review:7,resume_review:21};
function formatter(timezone:string) {
 try { return new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}); }
 catch { invariant(false,'invalid_timezone','Choose a valid IANA timezone.'); }
}
function parts(f:Intl.DateTimeFormat,date:Date) {
 const p = Object.fromEntries(f.formatToParts(date).map(p=>[p.type,p.value]));
 return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`};
}
export function validateSchedule(s:ScheduleSpec) {
 formatter(s.timezone);
 invariant(s.timezone.length<=100 && /^\d{4}-\d{2}-\d{2}$/.test(s.anchorDate) && /^([01]\d|2[0-3]):[0-5]\d$/.test(s.localTime),'invalid_schedule','Use a valid anchor date and local time.');
 const anchor = new Date(s.anchorDate+'T00:00:00Z');
 invariant(Number.isFinite(anchor.getTime()) && anchor.toISOString().slice(0,10)===s.anchorDate && anchor.getUTCFullYear()>=2000 && anchor.getUTCFullYear()<=2100,'invalid_schedule','Anchor date must be between 2000 and 2100.');
 invariant(s.kind!=='resume_review'||anchor.getUTCDay()===6,'saturday_required','The 21-day resume review must be anchored on Saturday.');
}
// Enumerate UTC minutes to choose the first fold, or the first valid minute after a DST gap.
function wallTime(f:Intl.DateTimeFormat,date:string,time:string) {
 const middle = Date.parse(date+'T'+time+':00Z');
 let fallback:Date|undefined;
 for(let t=middle-16*3600000;t<=middle+16*3600000;t+=60000) {
  const d = new Date(t),p=parts(f,d);
  if(p.date===date && p.time===time)return d;
  if(p.date===date && p.time>time && (!fallback || t<fallback.getTime()))fallback=d;
 }
 invariant(fallback,'invalid_schedule','This local date has no schedulable time.');
 return fallback;
}
export function scheduleWindow(s:ScheduleSpec,now:Date) {
 validateSchedule(s);
 const f=formatter(s.timezone),anchor=Date.parse(s.anchorDate+'T00:00:00Z'),today=Date.parse(parts(f,now).date+'T00:00:00Z');
 const step=intervals[s.kind]*day;
 let index=Math.max(0,Math.floor((today-anchor)/step));
 const at=(i:number)=>wallTime(f,new Date(anchor+i*step).toISOString().slice(0,10),s.localTime);
 let previous:Date|null=at(index);
 if(previous>now)previous=index>0?at(--index):null;
 return {previous,next:at(previous?index+1:0)};
}
