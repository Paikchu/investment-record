import assert from 'node:assert/strict';
import test from 'node:test';
import {emptyCalendar,refreshCalendar,monthEnd,withinReminderWindow,type CalendarEvent} from '../lib/earnings-live.ts';
const now=new Date('2026-09-08T10:00:00Z');
const event:CalendarEvent={symbol:'MSFT',name:'Microsoft',date:'2026-09-10',session:'after-market',confidence:'estimated',source:'Nasdaq',sourceUrl:'https://www.nasdaq.com',checkedAt:'2026-09-01T00:00:00Z'};
test('calendar month boundary and Beijing morning are inclusive',()=>{
 assert.equal(monthEnd('2026-01-31'),'2026-02-28');
 assert.equal(withinReminderWindow({...event,date:'2026-10-08'},now),true);
 assert.equal(withinReminderWindow({...event,date:'2026-10-09'},now),false);
 assert.equal(withinReminderWindow({...event,date:'2026-09-07'},now),true);
});
test('official announcement beats conflicting estimates; other records remain estimated',async()=>{
 const fetcher=async(input:RequestInfo|URL)=>Response.json({data:{rows:new URL(String(input)).searchParams.get('date')==='2026-09-08'?[{symbol:'ORCL',time:'time-not-supplied'},{symbol:'MSFT',time:'time-after-hours'}]:null}});
 const result=await refreshCalendar(emptyCalendar(),new Set(['ORCL','MSFT']),now,fetcher);
 assert.equal(result.status,'ready');
 assert.deepEqual(result.events.filter(e=>e.symbol==='ORCL').map(e=>[e.date,e.confidence]),[['2026-09-10','confirmed']]);
 assert.equal(result.events.find(e=>e.symbol==='MSFT')?.confidence,'estimated');
});
test('failure retains original timestamp; malformed payload never deletes records',async()=>{
 const result=await refreshCalendar({...emptyCalendar(),events:[event]},new Set(['MSFT']),now,async()=>Response.json({data:null}));
 assert.equal(result.status,'unavailable');assert.deepEqual(result.events,[event]);assert.equal(result.lastFullAt,null);
});
test('successful empty calendar removes old predictions and hourly scan is bounded',async()=>{
 const urls:string[]=[];
 const result=await refreshCalendar({...emptyCalendar(),events:[event],lastFullAt:now.toISOString()},new Set(['MSFT']),now,async input=>{urls.push(String(input));return Response.json({data:{rows:[]}})});
 assert.equal(result.events.length,0);assert.ok(urls.length<=7);assert.equal(result.lastFullAt,now.toISOString());
});
