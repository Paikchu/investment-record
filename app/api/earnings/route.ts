import {getD1} from '@/db';
import {readCalendar} from '@/lib/earnings-store';
import {emptyCalendar} from '@/lib/earnings-live';
export async function GET(){
  try{return Response.json(await readCalendar(await getD1()),{headers:{'cache-control':'no-store'}});}
  catch{return Response.json(emptyCalendar(),{status:503,headers:{'cache-control':'no-store'}});}
}
