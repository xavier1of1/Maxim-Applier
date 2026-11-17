import path from 'node:path';
import {createRequire} from 'node:module';
import yauzl from 'yauzl';
import mammoth from 'mammoth';
import * as yaml from 'js-yaml';
import {DomainError,invariant} from './errors';

export const intakeLimits={bytes:10*1024*1024,text:50000,pages:30,entries:500,expandedBytes:30*1024*1024,ratio:100,deadlineMs:20000};
export function validateDocument(name:string,bytes:Buffer,legacyYaml=false){
 invariant(name===path.basename(name)&&!/[\x00-\x1f\\/]/.test(name)&&name.length<=200,'invalid_filename','Choose a simple file name.');
 const format=path.extname(name).slice(1).toLowerCase();
 invariant(['pdf','docx','txt','md'].includes(format)||(legacyYaml&&format==='yml'),'unsupported_format','Supported sources are PDF, DOCX, Markdown and plain text.');
 invariant(bytes.length>0&&bytes.length<=intakeLimits.bytes,'file_size','Source must be between 1 byte and 10 MB.',413);
 if(format==='pdf')invariant(bytes.subarray(0,5).toString()==='%PDF-','invalid_pdf','The source is not a PDF.');
 else if(format==='docx')invariant(bytes.subarray(0,4).equals(Buffer.from([0x50,0x4b,3,4])),'invalid_docx','The source is not a DOCX archive.');
 else{
  let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new DomainError('invalid_text','The source must be valid UTF-8 text.');}
  invariant(!text.includes('\0')&&text.length<=intakeLimits.text,'text_limit','Text sources must be plain UTF-8 and at most 50,000 characters.');
 }
 return format;
}
export async function preflightDocx(bytes:Buffer){
 await new Promise<void>((resolve,reject)=>{
  yauzl.fromBuffer(bytes,{lazyEntries:true,validateEntrySizes:true,strictFileNames:true},(error,zip)=>{
   if(error||!zip){reject(new DomainError('invalid_docx','The DOCX archive is unreadable.'));return;}
   let count=0,total=0,actual=0,document=false,contentTypes=false,ended=false;
   const fail=(code='unsafe_archive')=>{if(!ended){ended=true;zip.close();reject(new DomainError(code,'The DOCX archive exceeds safety limits or contains unsupported active content.'));}};
   zip.on('error',()=>fail('invalid_docx'));
   zip.on('entry',entry=>{
    const name=entry.fileName.toLowerCase();
    if(++count>intakeLimits.entries||entry.uncompressedSize>intakeLimits.expandedBytes||
     (total+=entry.uncompressedSize)>intakeLimits.expandedBytes||
     entry.uncompressedSize>Math.max(1024,entry.compressedSize)*intakeLimits.ratio||
     entry.generalPurposeBitFlag&1||/(^|\/)\.\.(\/|$)|^[\\/]|^[a-z]:|\\/.test(name)||
     /vba|activex|embeddings|\.bin$|\.exe$|\.js$|\.html?$/.test(name)||
     (entry.externalFileAttributes>>>16&0o170000)===0o120000){fail();return;}
    if(name==='word/document.xml')document=true;
    if(name==='[content_types].xml')contentTypes=true;
    if(name.endsWith('/')){zip.readEntry();return;}
    zip.openReadStream(entry,(err,stream)=>{
     if(err||!stream){fail('invalid_docx');return;}
     const chunks:Buffer[]=[];
     stream.on('data',(chunk:Buffer)=>{actual+=chunk.length;if(actual>intakeLimits.expandedBytes){stream.destroy();fail();}else if(name.endsWith('.xml')||name.endsWith('.rels'))chunks.push(chunk);});
     stream.on('error',()=>fail('invalid_docx'));
     stream.on('end',()=>{
      if(ended)return;
      const xml=Buffer.concat(chunks).toString('utf8');
      if(/<!DOCTYPE|<!ENTITY|<w:altChunk\b|macroEnabled|vbaProject/i.test(xml)){fail();return;}
      zip.readEntry();
     });
    });
   });
   zip.on('end',()=>{if(ended)return;ended=true;if(!document||!contentTypes)reject(new DomainError('invalid_docx','Required DOCX document parts are missing.'));else resolve();});
   zip.readEntry();
  });
 });
}
export async function extractDocument(name:string,bytes:Buffer,legacyYaml=false){
 const format=validateDocument(name,bytes,legacyYaml);let text='';
 if(format==='yml'){
  const parsed=yaml.load(bytes.toString('utf8'),{schema:yaml.JSON_SCHEMA}),lines:string[]=[];
  const walk=(value:unknown,prefix:string,depth:number)=>{
   invariant(depth<=8&&lines.length<=100,'yaml_limit','Native YAML exceeds import limits.');
   if(value&&typeof value==='object'&&!Array.isArray(value)){
    for(const[key,child]of Object.entries(value)){invariant(!['__proto__','constructor','prototype'].includes(key),'unsafe_yaml','Unsafe YAML key.');walk(child,prefix?prefix+'.'+key:key,depth+1);}
   }else if(value!==null&&value!==undefined){
    const mapped=prefix==='candidate.full_name'?'candidate.name':prefix==='target_roles.primary'?'preferences.roles':prefix==='narrative.headline'?'positioning.headline':prefix;
    lines.push(mapped+': '+JSON.stringify(value));
   }
  };
  walk(parsed,'',0);text=lines.join('\n');
 }
 else if(format==='docx'){await preflightDocx(bytes);text=(await mammoth.extractRawText({buffer:bytes})).value;}
 else if(format==='pdf'){
  if(/\/(?:Encrypt|JavaScript|JS|OpenAction)\b/.test(bytes.toString('latin1')))throw new DomainError('unsupported_pdf','Encrypted or active PDF sources are not supported.');
  try{
   const pdf=await import('pdfjs-dist/legacy/build/pdf.mjs');
   const standardFontDataUrl=path.join(path.dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json')),'standard_fonts').replaceAll(path.sep,'/')+'/';
   const task=pdf.getDocument({data:new Uint8Array(bytes),standardFontDataUrl,useSystemFonts:false,stopAtErrors:true,enableXfa:false});
   try{
    const document=await task.promise;
    invariant(document.numPages<=intakeLimits.pages,'page_limit','PDF sources are limited to 30 pages.');
    for(let page=1;page<=document.numPages;page++){
     const content=await(await document.getPage(page)).getTextContent();
     text+=content.items.map(item=>'str'in item?item.str+('hasEOL'in item&&item.hasEOL?'\n':' '):'').join('')+'\n';
     invariant(text.length<=intakeLimits.text,'text_limit','Extracted text exceeds 50,000 characters.');
    }
   }finally{await task.destroy();}
  }catch(e){if(e instanceof DomainError)throw e;throw new DomainError('unreadable_pdf','PDF text could not be extracted; supply plain text for scanned or encrypted sources.');}
 }else text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 invariant(text.trim().length>0,'no_extractable_text','No text was found. Scanned sources require manually supplied text.');
 invariant(text.length<=intakeLimits.text,'text_limit','Extracted text exceeds 50,000 characters.');
 return {text,format};
}
