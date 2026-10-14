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
export function prepareName(image:Pixels,mode:'adaptive'|'green'|'original'|'soft'):Pixels{
 const out=new Uint8ClampedArray(image.data),red=new Set(strikeRows(image));
 if(mode!=='original')for(let i=0;i<out.length;i+=4){
  const y=Math.floor(i/4/image.width),r=out[i],g=out[i+1],b=out[i+2];
  const ink=mode==='soft'?g>115:mode==='green'?g>130:red.has(y)?g>145:r*.3+g*.59+b*.11>140;
  out[i]=out[i+1]=out[i+2]=ink?0:255;
 }return {width:image.width,height:image.height,data:out};
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
