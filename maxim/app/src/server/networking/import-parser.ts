import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {DomainError,invariant} from '../errors';

export const importLimits={bytes:2097152,rows:5000,columns:64,cell:8000,entries:100,expanded:8388608,deadlineMs:10000};
export type ImportRow={rowNumber:number;raw:Record<string,string>;values:string[]};

// Native CSV/XML parsers preserve quoted newlines and sparse cells. Nothing is extracted to disk.
const nativeParser=String.raw`
import sys,json,io,csv,zipfile,re,posixpath,xml.etree.ElementTree as ET
data=sys.stdin.buffer.read(2097153)
if not 0<len(data)<=2097152: raise ValueError('size')
fmt=sys.argv[1];offset=0
def archive(data):
 z=zipfile.ZipFile(io.BytesIO(data)); names=set(); total=0; parts={}
 if len(z.infolist())>100: raise ValueError('entries')
 for info in z.infolist():
  n=info.filename
  if n in names or n.startswith(('/','\\')) or '\\' in n or ':' in n or '..' in n.split('/') or (info.external_attr>>16)&0o170000==0o120000: raise ValueError('path')
  names.add(n); total+=info.file_size
  if info.flag_bits&1 or info.compress_type not in (0,8) or info.file_size>8388608 or total>8388608 or info.file_size>max(1024,info.compress_size)*100: raise ValueError('expansion')
  if re.search(r'vba|activex|embeddings|externalLinks|\.bin$|\.exe$|\.js$|\.html?$',n,re.I): raise ValueError('active')
  with z.open(info) as f: b=f.read(8388609)
  if len(b)!=info.file_size: raise ValueError('size')
  if n.endswith(('.xml','.rels')) and re.search(br'<!DOCTYPE|<!ENTITY|macroEnabled|vbaProject|TargetMode\s*=\s*["\x27]External',b,re.I): raise ValueError('active xml')
  parts[n]=b
 return parts
def xml(parts,name): return ET.fromstring(parts[name])
if fmt=='zip':
 parts=archive(data)
 candidates=[b for n,b in parts.items() if posixpath.basename(n).lower() in ('connections.csv','contacts.csv')]
 if len(candidates)!=1: raise ValueError('choose one connections CSV')
 data=candidates[0];fmt='csv'
if fmt=='csv':
 text=data.decode('utf-8-sig')
 if '\x00' in text: raise ValueError('NUL')
 csv.field_size_limit(8000);rows=[]
 for row in csv.reader(io.StringIO(text,newline=''),strict=True):
  if len(rows)>5020 or len(row)>64: raise ValueError('table bound')
  rows.append(row)
 if rows and rows[0] and rows[0][0].strip().lower().rstrip(':')=='notes':
  for i,row in enumerate(rows[:20]):
   keys={x.strip().lower() for x in row}
   if {'first name','last name'}.issubset(keys): rows=rows[i:];offset=i;break
else:
 parts=archive(data);ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
 if '[Content_Types].xml' not in parts: raise ValueError('workbook')
 shared=[]
 if 'xl/sharedStrings.xml' in parts:
  for item in xml(parts,'xl/sharedStrings.xml').findall('s:si',ns): shared.append(''.join(x.text or '' for x in item.iter('{'+ns['s']+'}t')))
 book=xml(parts,'xl/workbook.xml');sheets=book.findall('s:sheets/s:sheet',ns)
 if len(sheets)!=1: raise ValueError('supply one worksheet')
 rid=sheets[0].get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
 rel=next(r for r in xml(parts,'xl/_rels/workbook.xml.rels') if r.get('Id')==rid)
 target=rel.get('Target','');name=target.lstrip('/') if target.startswith('/') else posixpath.normpath('xl/'+target)
 if not name.startswith('xl/worksheets/'): raise ValueError('relationship')
 root=xml(parts,name);rows=[];row_numbers=[]
 if any(x.tag.endswith('}f') for x in root.iter()): raise ValueError('formula; supply values-only workbook')
 for row in root.findall('s:sheetData/s:row',ns):
  number=int(row.get('r','1'))
  if len(rows)>5000 or number>5001 or number<1 or row_numbers and number<=row_numbers[-1]: raise ValueError('rows')
  row_numbers.append(number)
  cells=[];seen=set()
  for cell in row.findall('s:c',ns):
   ref=cell.get('r','');m=re.fullmatch(r'([A-Z]{1,3})[1-9][0-9]*',ref)
   if not m: raise ValueError('cell reference')
   if int(re.search(r'[0-9]+$',ref)[0])!=number: raise ValueError('cell row')
   idx=0
   for c in m[1]: idx=idx*26+ord(c)-64
   if idx>64 or idx in seen: raise ValueError('columns')
   seen.add(idx)
   while len(cells)<idx: cells.append('')
   kind=cell.get('t','');v=cell.find('s:v',ns);value=(v.text or '') if v is not None else ''
   if kind=='s': value=shared[int(value)]
   elif kind=='inlineStr': value=''.join(x.text or '' for x in cell.findall('.//s:t',ns))
   elif kind=='e': raise ValueError('error cell')
   cells[idx-1]=value
  rows.append(cells)
rows=[(n,r) for n,r in (enumerate(rows,offset+1) if fmt=='csv' else zip(row_numbers,rows)) if any(x.strip() for x in r)]
if not rows: print('[]');sys.exit()
header=rows[0][1]
if not header or len(header)>64 or any(not h.strip() or len(h)>100 for h in header) or len(set(h.strip().lower() for h in header))!=len(header): raise ValueError('ambiguous headers')
if len(rows)>5001: raise ValueError('rows')
out=[]
for i,row in rows[1:]:
 if len(row)>len(header) or any(len(v)>8000 or '\x00' in v for v in row): raise ValueError('row')
 values=row+['']*(len(header)-len(row))
 out.append({'rowNumber':i,'raw':dict(zip(header,values)),'values':values})
print(json.dumps(out,ensure_ascii=True))
`;

export function parseImport(name:string,bytes:Buffer,kind:'contacts'|'history'):ImportRow[]{
 invariant(name===path.basename(name)&&!/[\\/\x00-\x1f]/.test(name)&&name.length<=200,'invalid_filename','Choose a simple import filename.');
 const format=path.extname(name).slice(1).toLowerCase();
 invariant(['csv','xlsx'].includes(format)||kind==='contacts'&&format==='zip','unsupported_import','Supply CSV, a values-only single-sheet XLSX, or a connections CSV ZIP.');
 invariant(bytes.length>0&&bytes.length<=importLimits.bytes,'import_size','Imports are limited to 2 MB.',413);
 const result=spawnSync('python',['-I','-c',nativeParser,format],{input:bytes,maxBuffer:16*1024*1024,timeout:importLimits.deadlineMs,windowsHide:true});
 if(result.error||result.status!==0)throw new DomainError('unsafe_import','Import rejected: verify UTF-8 CSV or a values-only single-sheet XLSX and archive/table limits. No rows were saved.');
 return JSON.parse(result.stdout.toString('utf8')) as ImportRow[];
}
export function fields(raw:Record<string,string>){
 const mapped=new Map(Object.entries(raw).map(([k,v])=>[k.trim().toLowerCase().replaceAll('_',' '),v.trim()]));
 return (...keys:string[])=>keys.map(k=>mapped.get(k)).find(v=>v!==undefined&&v!=='')||'';
}
