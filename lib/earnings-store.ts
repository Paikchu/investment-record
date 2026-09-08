import { emptyCalendar, type CalendarState } from './earnings-live.ts';
type Database = {prepare(sql:string):{bind(...values:unknown[]):{run():Promise<unknown>};first<T>():Promise<T|null>}};
export async function readCalendar(db:Database):Promise<CalendarState>{
  const row=await db.prepare("SELECT payload FROM earnings_calendar_state WHERE id = 'current'").first<{payload:string}>();
  return row?JSON.parse(row.payload) as CalendarState:emptyCalendar();
}
export async function writeCalendar(db:Database,state:CalendarState){
  await db.prepare("INSERT INTO earnings_calendar_state (id, payload) VALUES ('current', ?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload").bind(JSON.stringify(state)).run();
}
