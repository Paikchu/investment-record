import { parseNasdaqEarningsRows, sortEarningsEvents, type EarningsEvent } from './earnings-calendar.ts';

export type CalendarEvent = EarningsEvent & {
  confidence: 'confirmed' | 'estimated'; source: string; sourceUrl: string; checkedAt: string;
};
export type CalendarState = {
  events: CalendarEvent[]; lastAttemptAt: string | null; lastFullAt: string | null;
  status: 'ready' | 'partial' | 'unavailable'; successfulDates: number; requestedDates: number;
};
export const emptyCalendar = (): CalendarState => ({ events: [], lastAttemptAt: null, lastFullAt: null, status: 'unavailable', successfulDates: 0, requestedDates: 0 });

// Reviewed official announcements. Keep the actual verification time; a successful
// Nasdaq request must never make an official announcement appear freshly verified.
export const officialAnnouncements: CalendarEvent[] = [{
  symbol: 'ORCL', name: 'Oracle Corporation', date: '2026-09-10', session: 'after-market',
  confidence: 'confirmed', source: 'Oracle 投资者关系公告',
  sourceUrl: 'https://investor.oracle.com/investor-news/news-details/2026/Oracle-Sets-the-Date-for-its-First-Quarter-Fiscal-Year-2027-Earnings-Announcement/default.aspx',
  checkedAt: '2026-09-08T12:00:00Z',
}];

export function shanghaiDate(now: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function offsetDate(date: string, days: number) { return new Date(Date.parse(date+'T00:00:00Z')+days*86400000).toISOString().slice(0,10); }
/** A calendar month, clamping Jan 31 to the last day of February. */
export function monthEnd(date: string) {
  const [y,m,d]=date.split('-').map(Number);
  const last=new Date(Date.UTC(y,m+1,0)).getUTCDate();
  return new Date(Date.UTC(y,m,Math.min(d,last))).toISOString().slice(0,10);
}
export function withinReminderWindow(event: EarningsEvent, now: Date) {
  const today=shanghaiDate(now);
  const view=event.session==='after-market'?offsetDate(event.date,1):event.date;
  return view>=today && event.date<=monthEnd(today);
}
export function staleEvent(event: CalendarEvent, now: Date) { return now.getTime()-Date.parse(event.checkedAt)>48*3600000; }

export async function refreshCalendar(previous: CalendarState, symbols: Set<string>, now=new Date(), fetcher: typeof fetch=fetch): Promise<CalendarState> {
  const today=shanghaiDate(now);
  const full=!previous.lastFullAt || shanghaiDate(new Date(previous.lastFullAt))!==today;
  const end=full?monthEnd(today):offsetDate(today,7);
  const dates:string[]=[];
  // Yesterday includes US after-hours releases that fall on this Beijing morning.
  for(let day=offsetDate(today,-1);day<=end;day=offsetDate(day,1)) {
    const weekday=new Date(day+'T00:00:00Z').getUTCDay();
    if(weekday!==0&&weekday!==6)dates.push(day);
  }
  const success=new Set<string>();const fresh:CalendarEvent[]=[];
  let cursor=0;
  await Promise.all(Array.from({length:4},async()=>{
    while(cursor<dates.length){
      const date=dates[cursor++];
      try{
        const response=await fetcher(`https://api.nasdaq.com/api/calendar/earnings?date=${date}`,{headers:{accept:'application/json','user-agent':'Mozilla/5.0'},signal:AbortSignal.timeout(8000)});
        if(!response.ok)continue;
        const payload=await response.json() as {data?:{rows?:unknown}};
        // A missing/null data object is an upstream failure, not an empty calendar.
        if(!payload.data || !(payload.data.rows===null || Array.isArray(payload.data.rows)))continue;
        success.add(date);
        fresh.push(...parseNasdaqEarningsRows(payload,date,symbols).map(e=>({...e,confidence:'estimated' as const,source:'Nasdaq（预计）',sourceUrl:`https://www.nasdaq.com/market-activity/earnings?date=${date}`,checkedAt:now.toISOString()})));
      }catch{ /* Preserve only last successful observations for failed dates. */ }
    }
  }));
  const official=officialAnnouncements.filter(e=>symbols.has(e.symbol)&&withinReminderWindow(e,now));
  const confirmedSymbols=new Set(official.map(e=>e.symbol));
  const events=[...previous.events.filter(e=>!success.has(e.date)),...fresh]
    .filter(e=>symbols.has(e.symbol)&&withinReminderWindow(e,now)&&!confirmedSymbols.has(e.symbol));
  return {events:sortEarningsEvents([...events,...official]) as CalendarEvent[],lastAttemptAt:now.toISOString(),lastFullAt:full&&success.size===dates.length?now.toISOString():previous.lastFullAt,status:success.size===dates.length?'ready':success.size?'partial':'unavailable',successfulDates:success.size,requestedDates:dates.length};
}
