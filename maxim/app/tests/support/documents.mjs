import {PDFDocument} from 'pdfkit';
import JSZip from 'jszip';

export const resumeText='Alex Example\ncandidate.name: Alex Example\ncandidate.email: alex.synthetic@example.org\nauthorization.active_clearance: false\nskills.languages: ["Rust","TypeScript"]\n\nBuilt customer software using Rust and TypeScript. This is synthetic evidence for local tests.';
export async function pdfFixture({encrypted=false,pages=1,blank=false,text=resumeText}={}){
 const doc=new PDFDocument({compress:false,...(encrypted?{userPassword:'fixture-password',ownerPassword:'fixture-owner',pdfVersion:'1.7'}:{})});
 const chunks=[],done=new Promise((resolve,reject)=>{doc.on('data',b=>chunks.push(b));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});
 for(let i=0;i<pages;i++){if(i)doc.addPage();if(!blank)doc.fontSize(10).text(text);}
 doc.end();return done;
}
export async function docxFixture(extra={},text=resumeText){
 const zip=new JSZip();
 zip.file('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
 zip.file('_rels/.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
 const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 zip.file('word/document.xml','<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+text.split('\n').map(line=>'<w:p><w:r><w:t xml:space="preserve">'+escape(line)+'</w:t></w:r></w:p>').join('')+'</w:body></w:document>');
 for(const[name,value]of Object.entries(extra))zip.file(name,value);
 return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}
