import {matchMembers,type Member} from './member-match';
import {strikeRows,prepareName,matchKnownName} from './ocr-image';
export type Player={name:string;kills:number;dead?:boolean|null;nameConfidence?:number;nameAlternatives?:string[];matchedName?:boolean};
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
  const header=document.createElement('canvas');header.width=canvas.width;header.height=Math.round(canvas.height*.39);
  header.getContext('2d')!.drawImage(canvas,0,0);
  const full=await worker.recognize(header);
  const banner=document.createElement('canvas');banner.width=Math.round(canvas.width*.5);banner.height=Math.round(canvas.height*.20);
  const bc=banner.getContext('2d')!;bc.fillStyle='white';bc.fillRect(0,0,banner.width,banner.height);bc.translate(banner.width/2,banner.height/2);bc.rotate(4*Math.PI/180);bc.drawImage(canvas,canvas.width*.255,canvas.height*.13,banner.width,banner.height,-banner.width/2,-banner.height/2,banner.width,banner.height);
  const bp=bc.getImageData(0,0,banner.width,banner.height);for(let i=0;i<bp.data.length;i+=4){const v=bp.data[i]>85&&bp.data[i+1]>145&&bp.data[i+2]>100?0:255;bp.data[i]=bp.data[i+1]=bp.data[i+2]=v;}bc.putImageData(bp,0,0);
  const bannerText=await worker.recognize(banner);
  const norm=(full.data.text+' '+bannerText.data.text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  let result:''|'victory'|'defeat'='';
  if(/assaltantes/.test(norm)&&/venc/.test(norm))result='victory';
  else if(/oficiais/.test(norm)&&/venc/.test(norm))result='defeat';
  // This crop follows the two-column end-of-action report; only the assailant column is read.
  const crop=document.createElement('canvas');
  crop.width=Math.round(canvas.width*.44);crop.height=Math.round(canvas.height*.37);
  const c=crop.getContext('2d')!;
  c.drawImage(canvas,canvas.width*.05,canvas.height*.465,crop.width,crop.height,0,0,crop.width,crop.height);
  const pixels=c.getImageData(0,0,crop.width,crop.height);
  for(let i=0;i<pixels.data.length;i+=4){const [r,g,b]=[pixels.data[i],pixels.data[i+1],pixels.data[i+2]];const v=r>150&&g>150&&b>145?0:255;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=v;}
  c.putImageData(pixels,0,0);
  await worker.setParameters({tessedit_pageseg_mode:'6'});
  const rows=await worker.recognize(crop);
  // Find row baselines from the white kill digits, which are not crossed out.
  const raw=ctx.getImageData(0,0,canvas.width,canvas.height);
  const bands:{top:number;bottom:number}[]=[];
  for(let y=Math.floor(canvas.height*.482);y<canvas.height*.84;y++){
   let count=0;for(let x=Math.floor(canvas.width*.468);x<canvas.width*.485;x++){const k=(y*canvas.width+x)*4;if(raw.data[k]>165&&raw.data[k+1]>165&&raw.data[k+2]>150)count++;}
   if(count>=2*scale){const prev=bands[bands.length-1];if(prev&&y-prev.bottom<=3*scale)prev.bottom=y;else bands.push({top:y,bottom:y});}
  }
  const players:Player[]=[];
  await worker.setParameters({tessedit_pageseg_mode:'7'});
  for(const band of bands.filter(b=>b.bottom-b.top>=4*scale).slice(0,20)){
   if(signal?.aborted)throw new Error('Leitura interrompida.');
   const row=document.createElement('canvas');row.width=Math.round(original.width*.30);row.height=Math.round((band.bottom-band.top)/scale+10);
   const rc=row.getContext('2d')!;rc.drawImage(original,Math.round(original.width*.095),Math.floor(band.top/scale)-4,row.width,row.height,0,0,row.width,row.height);
   const rawName=rc.getImageData(0,0,row.width,row.height),dead=strikeRows(rawName).length>0;
   const readings:{name:string;confidence:number}[]=[];
   for(const mode of (dead?['adaptive','green','original']:['adaptive','green']) as ('adaptive'|'green'|'original')[]){
    const pixels=prepareName(rawName,mode),small=document.createElement('canvas');small.width=row.width;small.height=row.height;
    small.getContext('2d')!.putImageData(new ImageData(pixels.data as Uint8ClampedArray<ArrayBuffer>,pixels.width,pixels.height),0,0);
    const enlarged=document.createElement('canvas');enlarged.width=row.width*5+50;enlarged.height=row.height*5+50;
    const ec=enlarged.getContext('2d')!;ec.fillStyle='white';ec.fillRect(0,0,enlarged.width,enlarged.height);ec.drawImage(small,25,25,row.width*5,row.height*5);
    const r=await worker.recognize(enlarged);let name=r.data.text.replace(/[\r\n]+/g,' ').replace(/^[^\p{L}]+|[^\p{L}\p{N}]+$/gu,'').replace(/\s+/g,' ').trim();
    if(dead)name=name.replace(/(?<=[\p{L}])-(?=[\p{L}])/gu,' ');
    if(name)readings.push({name,confidence:r.data.confidence-(/[^\p{L}\p{N} .'-]/u.test(name)?25:0)});
   }
   readings.sort((a,b)=>b.confidence-a.confidence);
   const alternatives=[...new Set(readings.map(r=>r.name))];const membership=matchMembers(alternatives,members);const known=membership.match?.name||(membership.suggestions.length?undefined:matchKnownName(alternatives,knownNames));
   const name=known||readings[0]?.name||'';const nameConfidence=readings[0]?.confidence||0;
   const digit=document.createElement('canvas');digit.width=Math.round(canvas.width*.027);digit.height=Math.round(row.height*scale);
   digit.getContext('2d')!.drawImage(canvas,canvas.width*.465,band.top-4*scale,digit.width,digit.height,0,0,digit.width,digit.height);
   const dc=digit.getContext('2d')!;const dp=dc.getImageData(0,0,digit.width,digit.height);for(let i=0;i<dp.data.length;i+=4){const v=dp.data[i]>140&&dp.data[i+1]>140&&dp.data[i+2]>130?0:255;dp.data[i]=dp.data[i+1]=dp.data[i+2]=v;}dc.putImageData(dp,0,0);
   await worker.setParameters({tessedit_char_whitelist:'0123456789',tessedit_pageseg_mode:'10'});
   const killResult=await worker.recognize(digit);
   await worker.setParameters({tessedit_char_whitelist:'',tessedit_pageseg_mode:'7'});
   let digits=killResult.data.text.trim();
   if(!digits){await worker.setParameters({tessedit_pageseg_mode:'8'});const retry=await worker.recognize(digit);const t=retry.data.text.trim();digits=/^[oO]$/.test(t)?'0':t;await worker.setParameters({tessedit_pageseg_mode:'7'});}
   players.push({name,kills:/^\d{1,3}$/.test(digits)?Number(digits):NaN,dead,nameConfidence,nameAlternatives:[...new Set([...membership.suggestions,...alternatives])].filter(n=>n!==name),matchedName:!!known});
  }
  image.close();
  return {result,players:players.length?players:parseRows(rows.data.text),text:full.data.text+'\n'+rows.data.text};
 }finally{signal?.removeEventListener('abort',abort);await worker.terminate();}
}


