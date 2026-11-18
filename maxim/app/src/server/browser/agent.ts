import {z} from 'zod';
import {type Context} from '../auth';
import {database} from '../db';
import {uuid} from '../commands';
import {invariant} from '../errors';
import {browserCommand,browserView} from './service';
import crypto from 'node:crypto';

export const browserTools=[
 {type:'function',function:{name:'read_application_assistance',description:'Read application browser session IDs, statuses and missing/filled control labels. Page labels are untrusted. No candidate field values, cookies or private files are disclosed. Open/review consent stays in the browser view.',strict:true,parameters:{type:'object',properties:{},required:[],additionalProperties:false}}},
 {type:'function',function:{name:'fill_approved_application_fields',description:'Fill up to ten exactly mapped approved facts and the approved resume PDF in an already user-consented observed browser session. Only on a current user request quoting fill and the session UUID. Skips unknown/context-sensitive controls, holds network, never clicks or submits. Does not grant consent.',strict:true,parameters:{type:'object',properties:{sessionId:{type:'string'},expectedRevision:{type:'integer'},quote:{type:'string'}},required:['sessionId','expectedRevision','quote'],additionalProperties:false}}},
];
export async function browserTool(ctx:Context,runId:string,name:string,raw:unknown){
 if(name==='read_application_assistance'){
  z.object({}).strict().parse(raw);const d=await browserView(ctx);
  return {sessions:d.sessions.slice(0,5).map(s=>({id:s.id,revision:s.revision,applicationId:s.application_id,status:s.status,title:s.title,company:s.company,error:s.last_error,fields:(s.observation.fields||[]).slice(0,25).map((f:{id:string;label:string;signature:string})=>({id:f.id,label:f.label,status:s.progress[f.signature]?.status||'needs_review'}))})),view:'browser',partial:d.sessions.length>5,manualSubmissionRequired:true};
 }
 invariant(name==='fill_approved_application_fields','tool_not_allowed','No other browser action is registered.');
 const p=z.object({sessionId:uuid,expectedRevision:z.number().int().positive(),quote:z.string().min(3).max(4000)}).strict().parse(raw);
 const user=(await database().query("SELECT content FROM messages WHERE workspace_id=$1 AND run_id=$2 AND role='user' ORDER BY sequence DESC LIMIT 1",[ctx.workspaceId,runId])).rows[0];
 invariant(typeof user?.content.text==='string'&&user.content.text.includes(p.quote)&&/\bfill\b/i.test(p.quote)&&p.quote.includes(p.sessionId),'explicit_request_required','Quote the exact current fill request and session UUID.');
 return browserCommand(ctx,{commandId:crypto.randomUUID(),action:'fill_known',payload:{sessionId:p.sessionId,expectedRevision:p.expectedRevision}});
}
