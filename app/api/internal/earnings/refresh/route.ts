import { getD1 } from '@/db';
import { currentPortfolioSnapshot } from '@/lib/site-data';
import { refreshCalendar } from '@/lib/earnings-live';
import { readCalendar, writeCalendar } from '@/lib/earnings-store';
export async function POST(request:Request){
  const {env}=await import('cloudflare:workers');
  const key=(env as unknown as {PORTFOLIO_SYNC_KEY?:string}).PORTFOLIO_SYNC_KEY;
  if(!key || request.headers.get('x-portfolio-sync-key')!==key)return Response.json({error:'Unauthorized'},{status:401});
  const db=await getD1();
  const previous=await readCalendar(db);
  if(previous.lastAttemptAt && Date.now()-Date.parse(previous.lastAttemptAt)<5*60000)return Response.json({status:'recently_checked'});
  const portfolio=await currentPortfolioSnapshot();
  const symbols=new Set(portfolio.positions.map(p=>p.symbol));
  const state=await refreshCalendar(previous,symbols);
  await writeCalendar(db,state);
  return Response.json({status:state.status,events:state.events.length,successfulDates:state.successfulDates,requestedDates:state.requestedDates},{headers:{'cache-control':'no-store'}});
}
