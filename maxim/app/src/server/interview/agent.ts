import {z} from 'zod';
import {digest,type Context} from '../auth';
import {uuid} from '../commands';
import {invariant} from '../errors';
import {interviewCommand,interviewView} from './service';
import {modeSchema} from './policy';

export const interviewTools=[
 {type:'function',function:{name:'start_interview_practice',description:'Start optional interview practice only on an exact current user practice/rehearse request naming the role UUID and project defense, behavioral/STAR or system design. No model feedback, code execution or truth promotion is started. User continues in Interview practice.',strict:true,parameters:{type:'object',properties:{jobId:{type:'string'},expectedJobRevision:{type:'integer'},expectedCandidateRevision:{type:'integer'},mode:{type:'string',enum:['project_defense','behavioral','system_design']},quote:{type:'string'}},required:['jobId','expectedJobRevision','expectedCandidateRevision','mode','quote'],additionalProperties:false}}},
 {type:'function',function:{name:'read_interview_practice',description:'Read scoped practice IDs, modes and statuses for a role, not private attempts, feedback or evidence text. Practice is not approved candidate truth.',strict:true,parameters:{type:'object',properties:{jobId:{type:'string'}},required:['jobId'],additionalProperties:false}}},
];
export async function interviewTool(ctx:Context,runId:string,name:string,raw:unknown){
 if(name==='read_interview_practice'){
  const p=z.object({jobId:uuid}).strict().parse(raw),v=await interviewView(ctx,p);
  return {sessions:v.sessions.map(s=>({id:s.id,jobId:s.job_id,revision:s.revision,mode:s.mode,status:s.status,candidateRevision:s.candidate_revision,jobRevision:s.job_revision})),partial:v.partial,view:'interview',label:'Private practice, not approved facts or reusable answers'};
 }
 invariant(name==='start_interview_practice','unknown_tool','Unsupported interview tool.');
 const p=z.object({jobId:uuid,expectedJobRevision:z.number().int().positive(),expectedCandidateRevision:z.number().int().positive(),mode:modeSchema,quote:z.string().min(3).max(4000)}).strict().parse(raw);
 const hash=digest(runId+':interview:'+JSON.stringify(p));
 const commandId=hash.slice(0,8)+'-'+hash.slice(8,12)+'-4'+hash.slice(13,16)+'-a'+hash.slice(17,20)+'-'+hash.slice(20,32);
 const {quote,...payload}=p;
 const result=await interviewCommand(ctx,{commandId,action:'start_session',payload},{runId,quote});
 return {...result,jobId:p.jobId,view:'interview',url:'/maxim?view=interview&job='+p.jobId+'&practice='+result.id,label:'Private practice; no model feedback requested'};
}
