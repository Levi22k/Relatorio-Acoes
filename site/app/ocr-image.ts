export type Pixels={width:number;height:number;data:Uint8ClampedArray};
export function strikeRows(image:Pixels):number[]{
 const {width,height,data}=image, rows:number[]=[];
 for(let y=Math.floor(height*.15);y<height*.85;y++){
  let count=0,first=width,last=0;
  for(let x=0;x<width;x++){const i=(y*width+x)*4;const r=data[i],g=data[i+1],b=data[i+2];
   if(r>110&&r>g*1.2&&r>b*1.12){count++;first=Math.min(first,x);last=x;}}
  // A horizontal red line, not a handful of colored glyph pixels.
  if(count>=Math.max(14,width*.1)&&last-first>=Math.max(25,width*.18)&&count/(last-first+1)>.55)rows.push(y);
 }return rows;
}
export function prepareName(image:Pixels,mode:'adaptive'|'green'|'original'|'soft'|'contrast'):Pixels{
 const out=new Uint8ClampedArray(image.data),red=new Set(strikeRows(image));
 if(mode==='contrast'){
  // Keep antialiased letter edges. Thresholding a tiny name before enlarging it
  // discards information that the OCR cannot recover later.
  const levels=Array.from({length:image.width*image.height},(_,i)=>out[i*4+1]).sort((a,b)=>a-b);
  const low=levels[Math.floor(levels.length*.5)]||0,high=levels[Math.floor(levels.length*.995)]||255;
  for(let i=0;i<out.length;i+=4){const v=255-Math.round(Math.max(0,Math.min(1,(out[i+1]-low)/Math.max(30,high-low)))*255);out[i]=out[i+1]=out[i+2]=v;}
  return {width:image.width,height:image.height,data:out};
 }
 if(mode!=='original')for(let i=0;i<out.length;i+=4){
  const y=Math.floor(i/4/image.width),r=out[i],g=out[i+1],b=out[i+2];
  const ink=mode==='soft'?g>115:mode==='green'?g>130:red.has(y)?g>145:r*.3+g*.59+b*.11>140;
  out[i]=out[i+1]=out[i+2]=ink?0:255;
 }return {width:image.width,height:image.height,data:out};
}

export type OcrWord={text:string;bbox:{x0:number;y0:number;x1:number;y1:number}};
export type ReportLayout={left:number;span:number;top:number;bottom:number;fontHeight:number};
export function locateWinnerStamp(image:Pixels,layout:ReportLayout){
 const {width,data}=image,groups:{x0:number;x1:number;y0:number;y1:number;count:number}[]=[];
 for(let y=0;y<layout.top-layout.fontHeight*1.5;y++){
  let x0=width,x1=0,count=0;
  for(let x=Math.max(0,Math.floor(layout.left));x<Math.min(width,layout.left+layout.span*2);x++){
   const i=(y*width+x)*4,r=data[i],g=data[i+1],b=data[i+2];
   if((g>140&&g>r*1.15&&g>b*1.08)||(r>140&&r>g*1.15&&r>b*1.15)){x0=Math.min(x0,x);x1=x;count++;}
  }
  if(count<Math.max(4,layout.fontHeight*.35))continue;
  const last=groups.at(-1);
  if(last&&y-last.y1<=layout.fontHeight*.5){last.x0=Math.min(last.x0,x0);last.x1=Math.max(last.x1,x1);last.y1=y;last.count+=count;}
  else groups.push({x0,x1,y0:y,y1:y,count});
 }
 return groups.filter(g=>g.x1-g.x0>layout.span*.4&&g.x1-g.x0<layout.span*1.6&&g.y1-g.y0>layout.fontHeight*1.5).sort((a,b)=>b.count-a.count)[0];
}
export function locateReport(words:OcrWord[],width:number,height:number):ReportLayout|undefined{
 const similarity=(a:string,b:string)=>1-distance(normalized(a),b)/Math.max(normalized(a).length,b.length);
 // Paired headings on the same baseline distinguish the table from the winner banner.
 for(const attacker of words.filter(w=>similarity(w.text,'assaltantes')>=.7)){
  const a=attacker.bbox,fontHeight=a.y1-a.y0;
  const officer=words.find(w=>similarity(w.text,'oficiais')>=.65&&w.bbox.x0>a.x1&&Math.abs(w.bbox.y0-a.y0)<fontHeight*.7);
  if(!officer)continue;
  const span=officer.bbox.x0-a.x0;
  if(span<width*.12||span>width*.65||fontHeight<2)continue;
  const footer=words.find(w=>similarity(w.text,'ranking')>=.7&&w.bbox.y0>a.y1);
  return {left:a.x0,span,top:a.y1+fontHeight*.3,bottom:footer?.bbox.y0??height,fontHeight};
 }
}

export function locatedRows(image:Pixels,layout:ReportLayout){
 const {width,height,data}=image,{left,span,fontHeight}=layout;
 const bands:{top:number;bottom:number}[]=[];
 for(let y=Math.max(0,Math.ceil(layout.top));y<Math.min(height,layout.bottom);y++){
  let count=0;
  for(let x=Math.max(0,Math.floor(left));x<Math.min(width,left+span*.047);x++){
   const i=(y*width+x)*4;if(data[i]>100&&data[i+1]>120&&data[i+2]>120)count++;
  }
  if(count>=Math.max(1,fontHeight*.06)){
   const last=bands[bands.length-1];
   if(last&&y-last.bottom<=Math.max(1,fontHeight*.17))last.bottom=y;else bands.push({top:y,bottom:y});
  }
 }
 const valid=bands.filter(b=>b.bottom-b.top>=Math.max(2,fontHeight*.16)&&b.bottom-b.top<=fontHeight*1.6);
 // Stop at the end of the numbered list instead of collecting unrelated footer text.
 const rows:typeof bands=[];
 for(const b of valid){
  const previous=rows.at(-1);
  if(!previous&&b.top-layout.top>fontHeight*6)break;
  if(previous&&b.top-previous.bottom>fontHeight*5)break;
  rows.push(b);
 }
 return rows;
}
const normalized=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export function distance(a:string,b:string):number{
 let prev=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=next;}return prev[b.length];
}
export function matchKnownName(candidates:string[],knownNames:string[]):string|undefined{
 const names=[...new Map(knownNames.filter(Boolean).map(n=>[normalized(n),n])).values()];
 const ranked=names.map(name=>({name,score:Math.max(...candidates.filter(Boolean).map(c=>1-distance(normalized(c),normalized(name))/Math.max(normalized(c).length,normalized(name).length,1)))})).sort((a,b)=>b.score-a.score);
 if(ranked[0]?.score>=.86&&(!ranked[1]||ranked[0].score-ranked[1].score>=.08))return ranked[0].name;
}


// Row numbers remain visible even when a name is crossed out or the kill digit is faint.
export function reportRows(image:Pixels,scale:number){
 const {width,height,data}=image,bands:{top:number;bottom:number}[]=[];
 for(let y=Math.floor(height*.39);y<height*.85;y++){
  let count=0;for(let x=Math.floor(width*.061);x<width*.087;x++){
   const i=(y*width+x)*4;if(data[i]>100&&data[i+1]>120&&data[i+2]>120)count++;
  }
  if(count>=Math.max(1,scale)){
   const last=bands[bands.length-1];if(last&&y-last.bottom<=2*scale)last.bottom=y;else bands.push({top:y,bottom:y});
  }
 }
 const valid=bands.filter(b=>b.bottom-b.top>=2*scale&&b.bottom-b.top<height*.045);
 const heights=valid.map(b=>b.bottom-b.top).sort((a,b)=>a-b),median=heights[Math.floor(heights.length/2)]||0;
 return valid.filter(b=>valid.length<3||b.bottom-b.top<=median*1.5);
}

export function countTallies(image:Pixels):number{
 const {width,height,data}=image;let best=0;
 for(let y=Math.floor(height*.25);y<height*.75;y++){
  let runs=0,inside=false;for(let x=0;x<width;x++){
   const i=(y*width+x)*4,r=data[i],g=data[i+1],b=data[i+2];
   const ink=r>135&&g>105&&r>g*.95&&b<r*.8&&g>b*1.1;
   if(ink&&!inside)runs++;inside=ink;
  }best=Math.max(best,runs);
 }return best;
}
