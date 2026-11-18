import {config} from '../config';
import {invariant} from '../errors';

export type Field={id:string;frame:number;origin:string;tag:string;type:string;name:string;label:string;required:boolean;signature:string;valueHash:string;options:{value:string;label:string}[];disabled:boolean};
export type Observation={id:string;url:string;origin:string;fields:Field[];issues:string[];observedAt:string};
export const providers=['job-boards.greenhouse.io','boards.greenhouse.io','job-boards.eu.greenhouse.io','jobs.lever.co'];
export function destination(raw:string){
 const u=new URL(raw),c=config();
 invariant(!u.username&&!u.password&&!u.hash,'browser_destination_denied','Use the exact stored posting destination without credentials or fragments.');
 if(c.testMode&&c.discoveryFixtureOrigin===u.origin)return {url:u.href,origin:u.origin,provider:'fixture'};
 invariant(u.protocol==='https:'&&providers.includes(u.hostname)&&u.port==='','browser_unsupported','This form host is not in the supported pilot. Open it manually; the job is retained.');
 invariant(u.pathname.split('/').filter(Boolean).length>=2,'browser_posting_required','Select a specific application, not a company directory.');
 if(u.hostname==='jobs.lever.co'&&!/\/apply\/?$/.test(u.pathname))u.pathname=u.pathname.replace(/\/$/,'')+'/apply';
 return {url:u.href,origin:u.origin,provider:u.hostname.includes('greenhouse')?'greenhouse':'lever'};
}
export function allowedResource(raw:string,origin:string){
 try{const u=new URL(raw),c=config();if(c.testMode&&c.discoveryFixtureOrigin===origin&&u.origin===origin)return true;
 return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&[...providers,'boards-api.greenhouse.io','assets.greenhouse.io','cdn.greenhouse.io','api.lever.co','lever-client-logos.s3.us-west-2.amazonaws.com'].includes(u.hostname);
 }catch{return false;}
}
export function fieldAction(field:Field,value:unknown){
 invariant(!field.disabled,'browser_control_disabled','This field is no longer editable.');
 invariant(!['password','hidden','submit','button','reset','image','file'].includes(field.type),'browser_action_denied','This control requires a manual action.');
 if(field.type==='checkbox'||field.type==='radio'){invariant(typeof value==='boolean','browser_value_type','Choose an explicit boolean value.');return;}
 invariant(typeof value==='string'&&value.length<=8000,'browser_value_type','Use a reviewed text value.');
 if(field.tag==='select')invariant(field.options.some(o=>o.value===value),'browser_unknown_option','Choose an observed option, not an invented value.');
 invariant(field.tag==='select'||field.tag==='textarea'||['text','email','tel','url','number'].includes(field.type),'browser_control_unsupported','This custom control is manual-only.');
}
