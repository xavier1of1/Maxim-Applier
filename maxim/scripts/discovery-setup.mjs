import fs from 'node:fs';
import crypto from 'node:crypto';
import {withWorkspace} from '../lib/workspace-client.mjs';

const args=process.argv.slice(2);
try{
 if(args.length>1||args.some(a=>!['--apply','--help'].includes(a)))throw Error('Use maxim:discovery:setup [--apply].');
 if(args.includes('--help')){
  console.log('Preview NoVA/DC public boards; --apply adds missing boards and disables a superseded empty board only after its replacement succeeds. No scan or deletion.');
 }else{
  const apply=args.includes('--apply'),boards=JSON.parse(fs.readFileSync(new URL('../config/nova-dc-boards.json',import.meta.url),'utf8'));
  const changes=await withWorkspace(async request=>{
   const {sources,partial}=await request('/api/discovery');
   if(partial.sources)throw Error('Source list is partial; review sources in the dashboard instead.');
   const same=(s,b)=>s.provider===b.provider&&s.board===b.board;
   const command=(action,payload)=>request('/api/discovery/commands',{commandId:crypto.randomUUID(),action,payload});
   const plan=[];
   for(const {evidence,replaces,...board} of boards){
    const current=sources.find(s=>same(s,board));
    if(!current&&apply)await command('add_source',board);
    plan.push({...board,evidence,action:current?(current.enabled?'keep':'keep_disabled'):apply?'added':'add'});
    if(!replaces)continue;
    const old=sources.find(s=>same(s,replaces)&&s.enabled);
    if(!old)continue;
    const tested=current?.enabled&&['success','partial'].includes(current.status)&&old.status==='empty_success';
    if(tested&&apply)await command('set_source_enabled',{sourceId:old.id,expectedRevision:old.revision,enabled:false});
    plan.push({...replaces,action:tested?(apply?'disabled_superseded':'disable_superseded'):'keep_until_replacement_checked'});
   }
   return plan;
  });
  console.log(JSON.stringify({applied:apply,changes},null,2));
 }
}catch(error){console.error(error.message);process.exitCode=1;}
