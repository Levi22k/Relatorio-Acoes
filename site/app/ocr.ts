import {matchMembers,type Member} from './member-match';
import {strikeRows,prepareName,matchKnownName,locateReport,locateWinnerStamp,locatedRows,countTallies,type OcrWord} from './ocr-image';
export type Player={name:string;kills:number;dead?:boolean|null;killsUncertain?:boolean;nameConfidence?:number;nameAlternatives?:string[];matchedName?:boolean};
export function parseRows(text:string):Player[]{
 return text.split('\n').flatMap(line=>{
  const m=line.trim().match(/^(?:\d{1,2}[.)]?\s+)?([\p{L}][\p{L}\p{N} _.'-]{1,79}?)\s+[|/\\\s]*(\d{1,3})\s*$/u);
  if(!m || /assaltantes|oficiais|abates|ranking/i.test(m[1]))return [];
  return [{name:m[1].trim(),kills:Number(m[2])}];
 });
}
let library:Promise<any>|undefined;
function load(){
 if((window as any).Tesseract)return Promise.resolve((window as any).Tesseract);
 if(!library)library=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  script.onload=()=>resolve((window as any).Tesseract);script.onerror=()=>{library=undefined;script.remove();reject(new Error('Não foi possível carregar a leitura automática. Preencha os campos manualmente.'));};document.head.appendChild(script);
 });return library;
}
export async function readPrint(file:File,onProgress:(s:string)=>void,signal?:AbortSignal,knownNames:string[]=[],members:Member[]=[]){
 const lib=await load();const worker=await lib.createWorker('por+eng',1,{logger:(m:any)=>{if(m.status==='recognizing text')onProgress('Lendo a print… '+Math.round(m.progress*100)+'%');}});
 const abort=()=>{void worker.terminate()};signal?.addEventListener('abort',abort,{once:true});
 try{
  if(signal?.aborted)throw new Error('Leitura interrompida. Preencha os dados manualmente.');
  const image=await createImageBitmap(file);
  const original=document.createElement('canvas');original.width=image.width;original.height=image.height;original.getContext('2d')!.drawImage(image,0,0);
  const canvas=document.createElement('canvas');
  const scale=Math.min(3,2400/image.width);
  canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);
  const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0,canvas.width,canvas.height);
  onProgress('Localizando a tabela e as linhas dos participantes…');
  const source=ctx.getImageData(0,0,canvas.width,canvas.height);
  let layout:ReturnType<typeof locateReport>,documentText='',detectedHeader='',documentWords:OcrWord[]=[];
  await worker.setParameters({tessedit_pageseg_mode:'11'});
  for(const threshold of [125,145]){
   const scan=document.createElement('canvas');scan.width=canvas.width;scan.height=canvas.height;
   const sc=scan.getContext('2d')!,px=new ImageData(new Uint8ClampedArray(source.data),source.width,source.height);
   for(let i=0;i<px.data.length;i+=4){const v=px.data[i+1]>threshold?0:255;px.data[i]=px.data[i+1]=px.data[i+2]=v;}
   sc.putImageData(px,0,0);
   const reading=await worker.recognize(scan);documentText=reading.data.text;documentWords=reading.data.words||[];
   layout=locateReport(reading.data.words||[],canvas.width,canvas.height);
   if(layout&&locatedRows(source,layout).length){detectedHeader=(reading.data.words||[]).filter((w:any)=>w.bbox.y1<layout!.top-layout!.fontHeight).map((w:any)=>w.text).join(' ');break;}
  }
  if(!layout)throw new Error('Não foi possível localizar a tabela de assaltantes. Use a print completa do relatório, sem cortar os títulos, ou preencha manualmente.');
  const bands=locatedRows(source,layout);
  if(!bands.length)throw new Error('A tabela foi localizada, mas as linhas estão pouco legíveis. Tente a print original ou preencha manualmente.');
  // Read only the area ABOVE the table: its headings contain both team names.
  const header=document.createElement('canvas');header.width=canvas.width;header.height=Math.max(1,Math.floor(layout.top-layout.fontHeight*1.5));
  header.getContext('2d')!.drawImage(canvas,0,0);
  const full=await worker.recognize(header);
  const stamp=locateWinnerStamp(source,layout);
  const stampSource=document.createElement('canvas');stampSource.width=stamp?stamp.x1-stamp.x0+20:header.width;stampSource.height=stamp?stamp.y1-stamp.y0+20:header.height;
  stampSource.getContext('2d')!.drawImage(canvas,stamp?stamp.x0-10:0,stamp?stamp.y0-10:0,stampSource.width,stampSource.height,0,0,stampSource.width,stampSource.height);
  const banner=document.createElement('canvas');banner.width=stampSource.width;banner.height=stampSource.height;
  const bc=banner.getContext('2d')!;bc.fillStyle='white';bc.fillRect(0,0,banner.width,banner.height);bc.translate(banner.width/2,banner.height/2);bc.rotate(4*Math.PI/180);bc.drawImage(stampSource,-stampSource.width/2,-stampSource.height/2);
  const bp=bc.getImageData(0,0,banner.width,banner.height);for(let i=0;i<bp.data.length;i+=4){const r=bp.data[i],g=bp.data[i+1],b=bp.data[i+2];const v=(r>85&&g>145&&b>100)||(r>140&&r>g*1.15&&r>b*1.15)?0:255;bp.data[i]=bp.data[i+1]=bp.data[i+2]=v;}bc.putImageData(bp,0,0);
  await worker.setParameters({tessedit_pageseg_mode:'6'});
  const bannerText=await worker.recognize(banner);
  const norm=(detectedHeader+' '+full.data.text+' '+bannerText.data.text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,'');
  let result:''|'victory'|'defeat'='';
  if(/assaltantes/.test(norm)&&/venc/.test(norm))result='victory';
  else if(/oficiais/.test(norm)&&/venc/.test(norm))result='defeat';
  // Supply the roster to the recognizer itself, as well as comparing its output.
  const vocabulary=[...new Set([...knownNames,...members.flatMap(m=>[m.name,...m.aliases])].flatMap(n=>n.split(/\s+/)).filter(n=>/^[\p{L}\p{N}'-]+$/u.test(n)))];
  await worker.writeText('/members.txt',vocabulary.join('\n'));
  await worker.reinitialize('por+eng',1,{user_words_file:'/members.txt'});
  const players:Player[]=[];
  await worker.setParameters({tessedit_pageseg_mode:'7'});
  for(const [index,band] of bands.slice(0,50).entries()){
   if(signal?.aborted)throw new Error('Leitura interrompida.');
   onProgress('Lendo participante '+(players.length+1)+' de '+bands.length+'…');
   const pad=Math.max(4,layout.fontHeight/scale*.65),rowTop=Math.max(0,Math.floor(Math.max(band.top/scale-pad,index?(bands[index-1].bottom+band.top)/scale/2:0)));
   const rowBottom=Math.min(original.height,Math.ceil(Math.min(band.bottom/scale+pad+1,bands[index+1]?(band.bottom+bands[index+1].top)/scale/2:original.height)));
   const row=document.createElement('canvas');row.width=Math.round(layout.span*.68/scale);row.height=rowBottom-rowTop;
   const rc=row.getContext('2d')!;rc.drawImage(original,Math.round((layout.left+layout.span*.075)/scale),rowTop,row.width,row.height,0,0,row.width,row.height);
   const rawName=rc.getImageData(0,0,row.width,row.height),dead=result==='defeat'||strikeRows(rawName).length>0;
   const readings:{name:string;confidence:number}[]=[];
   const contextualName=documentWords.filter(w=>w.bbox.x0>=layout!.left+layout!.span*.06&&w.bbox.x1<layout!.left+layout!.span*.74&&(w.bbox.y0+w.bbox.y1)/2>=rowTop*scale&&(w.bbox.y0+w.bbox.y1)/2<rowBottom*scale).sort((a,b)=>a.bbox.x0-b.bbox.x0).map(w=>w.text).join(' ');
   if(contextualName)readings.push({name:contextualName,confidence:40});
   for(const mode of ['contrast','adaptive','green','original','soft'] as const){
    const pixels=prepareName(rawName,mode),small=document.createElement('canvas');small.width=row.width;small.height=row.height;
    small.getContext('2d')!.putImageData(new ImageData(pixels.data as Uint8ClampedArray<ArrayBuffer>,pixels.width,pixels.height),0,0);
    for(const quality of mode==='contrast'||mode==='original'?['low','high'] as const:['low'] as const){
    const enlarged=document.createElement('canvas');enlarged.width=row.width*5+50;enlarged.height=row.height*5+50;
    const ec=enlarged.getContext('2d')!;ec.imageSmoothingQuality=quality;ec.fillStyle='white';ec.fillRect(0,0,enlarged.width,enlarged.height);ec.drawImage(small,25,25,row.width*5,row.height*5);
    for(const segmentation of mode==='contrast'||mode==='green'?['7','13']:['7']){
    await worker.setParameters({tessedit_pageseg_mode:segmentation});
    const r=await worker.recognize(enlarged);let name=r.data.text.replace(/[\r\n]+/g,' ').replace(/[|¦].*$/u,'').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,'').replace(/\s+/g,' ').trim();
    if(dead)name=name.replace(/(?<=[\p{L}])-(?=[\p{L}])/gu,' ');
    if(name)readings.push({name,confidence:r.data.confidence-(/[^\p{L}\p{N} .'-]/u.test(name)?25:0)});
    }
   }
   }
   readings.sort((a,b)=>b.confidence-a.confidence);
   const alternatives=[...new Set(readings.map(r=>r.name))];const membership=matchMembers(alternatives,members);const known=membership.match?.name||(membership.suggestions.length?undefined:matchKnownName(alternatives,knownNames));
   if(readings.some(r=>/ssaltante|oficia|abates/i.test(r.name)))continue;
   const name=known||readings[0]?.name||'';const nameConfidence=readings[0]?.confidence||0;
   const digit=document.createElement('canvas');digit.width=Math.round(layout.span*.065);digit.height=Math.round(row.height*scale);
   digit.getContext('2d')!.drawImage(canvas,layout.left+layout.span*.89,rowTop*scale,digit.width,digit.height,0,0,digit.width,digit.height);
   const dc=digit.getContext('2d')!;const dp=dc.getImageData(0,0,digit.width,digit.height);for(let i=0;i<dp.data.length;i+=4){const v=dp.data[i]>100&&dp.data[i+1]>120&&dp.data[i+2]>120?0:255;dp.data[i]=dp.data[i+1]=dp.data[i+2]=v;}dc.putImageData(dp,0,0);
   await worker.setParameters({tessedit_char_whitelist:'0123456789',tessedit_pageseg_mode:'7'});
   const padded=document.createElement('canvas');padded.width=digit.width+40;padded.height=digit.height+40;
   const pc=padded.getContext('2d')!;pc.fillStyle='white';pc.fillRect(0,0,padded.width,padded.height);pc.drawImage(digit,20,20);
   const killResult=await worker.recognize(padded);
   await worker.setParameters({tessedit_char_whitelist:'',tessedit_pageseg_mode:'7'});
   let digits=killResult.data.text.trim();
   if(!digits){await worker.setParameters({tessedit_pageseg_mode:'8'});const retry=await worker.recognize(padded);const t=retry.data.text.trim();digits=/^[oO]$/.test(t)?'0':t;await worker.setParameters({tessedit_pageseg_mode:'7'});}
   const tallyPixels=ctx.getImageData(Math.floor(layout.left+layout.span*.75),Math.floor(rowTop*scale),Math.ceil(layout.span*.13),Math.round(row.height*scale));
   const tallies=countTallies(tallyPixels);
   // Yellow tally marks offer independent evidence when the printed number is faint.
   const uncertain=!/^\d{1,3}$/.test(digits)||(tallies>0&&Number(digits)!==tallies);
   if(tallies>0&&tallies<=5)digits=String(tallies);
   players.push({name,kills:/^\d{1,3}$/.test(digits)?Number(digits):0,killsUncertain:uncertain,dead,nameConfidence,nameAlternatives:[...new Set([...membership.suggestions,...alternatives])].filter(n=>n!==name),matchedName:!!known});
  }
  image.close();
  return {result,players:players.map(p=>({...p,dead:result==='defeat'?true:p.dead})),text:full.data.text+'\n'+documentText};
 }finally{signal?.removeEventListener('abort',abort);await worker.terminate();}
}


