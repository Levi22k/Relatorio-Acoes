import fs from 'node:fs';import ts from 'typescript';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync('app/ranking-filters.ts','utf8').replace(/export /g,'');const api=vm.runInNewContext(ts.transpile(source,{target:ts.ScriptTarget.ES2022})+';({filterRankingActions,rankingDay,locationKey})');
const now=new Date('2026-11-01T02:30:00Z');assert.equal(api.rankingDay(now),'2026-10-31');
const rows=['2026-10-24','2026-10-25','2026-10-28','2026-10-29','2026-10-30','2026-10-31','2026-11-01'].map(date=>({date,title:'Banco de Saint Denis'}));rows.push({date:'2026-10-31',title:'Banco de Rhodes'});const snapshot=JSON.stringify(rows);
const pick=(p,place='')=>api.filterRankingActions(rows,p,place,now);
assert.equal(pick('today').length,2);assert.equal(pick('3').length,4);assert.equal(pick('7').length,6);assert.equal(pick('all').length,8);assert.equal(pick('3',api.locationKey(' Banco de SAINT DENIS ')).length,3);assert.equal(pick('all',api.locationKey('Banco de Rhodes')).length,1);assert.equal(pick('7','missing').length,0);assert.equal(JSON.stringify(rows),snapshot);
const jan=new Date('2027-01-01T12:00:00Z');assert.equal(api.filterRankingActions([{date:'2026-12-30',title:'x'}],'3','',jan).length,1);
console.log('PASS: inclusive periods, Brasília midnight, month/year boundaries, combined location filters, all-time and unchanged records.');
