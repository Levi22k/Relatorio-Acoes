import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
const url=source=>'data:text/javascript;base64,'+Buffer.from(ts.transpile(source,{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022})).toString('base64');
const imageUrl=url(await fs.readFile(new URL('./app/ocr-image.ts',import.meta.url),'utf8'));
const {locateReport,locatedRows,prepareName}=await import(imageUrl);
const memberSource=(await fs.readFile(new URL('./app/member-match.ts',import.meta.url),'utf8')).replace("'./ocr-image'",JSON.stringify(imageUrl));
const {matchMembers}=await import(url(memberSource));
for(const count of [1,6,8,16])for(const [left,top] of [[30,20],[170,150]]){
 const width=1000,height=1000,span=350,fontHeight=14,data=new Uint8ClampedArray(width*height*4);
 const words=[{text:'Ansaltantes',bbox:{x0:left,y0:top,x1:left+100,y1:top+fontHeight}},{text:'Ofictais',bbox:{x0:left+span,y0:top,x1:left+span+70,y1:top+fontHeight}}];
 const layout=locateReport(words,width,height);assert.ok(layout);
 for(let row=0;row<count;row++)for(let y=top+32+row*30;y<top+40+row*30;y++)for(let x=left+3;x<left+11;x++){const i=(y*width+x)*4;data[i]=data[i+1]=data[i+2]=220;data[i+3]=255;}
 assert.equal(locatedRows({width,height,data},layout).length,count,`${count} rows at ${left},${top}`);
}
assert.equal(locateReport([{text:'Assaltantes',bbox:{x0:10,y0:10,x1:100,y1:30}},{text:'Oficiais',bbox:{x0:400,y0:160,x1:500,y1:180}}],1000,600),undefined);
const members=[{id:'1',name:'Levi Modric',aliases:['Levi']},{id:'2',name:'Dime Modric',aliases:[]},{id:'3',name:'John Smith',aliases:[]},{id:'4',name:'John Smitz',aliases:[]}];
assert.equal(matchMembers(['Levi'],members).match?.name,'Levi Modric');
assert.equal(matchMembers(['Levi Modnc','Levi Modric'],members).match?.name,'Levi Modric');
assert.equal(matchMembers(['John Smit'],members).match,undefined);
assert.equal(matchMembers(['Desconhecido'],members).match,undefined);
assert.equal(matchMembers(['Modric'],members).match,undefined);
assert.equal(matchMembers(['1evi Modric'],members).match?.name,'Levi Modric');
assert.equal(matchMembers(['Levi Modric'],[...members,{id:'5',name:'Levi Modric',aliases:[]}]).match,undefined);
assert.equal(matchMembers(['Rondito Feamok'],[{id:'6',name:'Rondito Fearnok',aliases:[]}]).match?.name,'Rondito Fearnok');
assert.equal(matchMembers(['John Srnit'],members).match,undefined,'similar competing full names remain uncertain');
const px=prepareName({width:5,height:1,data:new Uint8ClampedArray([0,80,0,255,0,80,0,255,0,100,0,255,0,170,0,255,0,220,0,255])},'contrast');assert.ok(px.data[12]>0&&px.data[12]<255,'preserves intermediate antialiasing');
console.log('PASS: dynamic headings, 1/6/8/16 rows at different positions, unrelated headings, registered aliases, uncertain/shared names, grayscale detail.');

