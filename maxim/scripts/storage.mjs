import {storageReport,createCleanupPlan,applyCleanupPlan} from '../lib/storage-maintenance.mjs';
const [action='report',...args]=process.argv.slice(2);
if(action==='--help'||args.includes('--help')){console.log('maxim:storage reports disk usage. maxim:clean [--dry-run] writes a preview only. Apply exactly that preview with maxim:clean -- --apply --plan <printed-path>. No global prune, live data, unverified folders or shared browser-cache deletion is supported.');process.exit(0);}
try{
 let result;
 if(action==='report'&&!args.length)result=storageReport();
 else if(action==='clean'&&(!args.length||args.length===1&&args[0]==='--dry-run'))result=createCleanupPlan();
 else if(action==='clean'&&args.length===3&&args[0]==='--apply'&&args[1]==='--plan')result=applyCleanupPlan(args[2]);
 else throw Error('Use report; clean (preview); or clean --apply --plan <printed-plan-path>');
 console.log(JSON.stringify(result,null,2));if(result.kept?.some(x=>x.reason!=='owner_running'))process.exitCode=1;
}catch(e){console.error(JSON.stringify({ok:false,error:e.message}));process.exitCode=1;}
