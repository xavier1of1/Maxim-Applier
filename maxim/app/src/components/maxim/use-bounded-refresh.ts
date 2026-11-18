'use client';
import {useEffect} from 'react';

// Local status reads only: one in flight, visible pages only, ninety-second ceiling.
export function useBoundedRefresh(enabled:boolean,load:()=>Promise<void>){
 useEffect(()=>{
  if(!enabled)return;
  let cancelled=false,timer:ReturnType<typeof setTimeout>;
  const deadline=Date.now()+90000;
  const step=async()=>{
   if(cancelled||Date.now()>=deadline)return;
   if(!document.hidden)await load();
   if(!cancelled&&Date.now()<deadline)timer=setTimeout(()=>void step(),2000);
  };
  timer=setTimeout(()=>void step(),2000);
  return()=>{cancelled=true;clearTimeout(timer);};
 },[enabled,load]);
}
