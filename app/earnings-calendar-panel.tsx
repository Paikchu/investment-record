"use client";
import { Badge } from '@/components/ui/badge';
import { buildEarningsReminder } from '@/lib/earnings-calendar';
import { staleEvent, withinReminderWindow, type CalendarState } from '@/lib/earnings-live';

export function EarningsCalendarPanel({calendar,asOf,symbols}:{calendar:CalendarState;asOf:string;symbols:Set<string>}){
  const now=new Date(asOf);
  const events=calendar.events.filter(e=>symbols.has(e.symbol)&&withinReminderWindow(e,now));
  return <section className="earnings-calendar-panel" aria-label="未来一个月财报提醒">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2>未来一个月财报</h2>
      <span className="text-xs text-muted-foreground">{calendar.lastAttemptAt?`最近检查 ${new Date(calendar.lastAttemptAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}（北京）`:'等待首次更新'}</span>
    </div>
    {calendar.status!=='ready'&&<p className="text-xs text-muted-foreground">数据源暂时不完整，保留上次记录；未列出的公司不代表没有财报。</p>}
    {events.length===0?<p className="text-sm text-muted-foreground">未来一个月暂无可用日期，已公布日期将自动出现在这里。</p>:<ul className="earnings-calendar-events">
      {events.map(e=>{const reminder=buildEarningsReminder(e,asOf);const stale=staleEvent(e,now);return <li key={e.symbol+e.date}>
        <strong>{e.symbol}</strong><span>{reminder.releaseDateLabel} · {reminder.sessionLabel}</span>
        <Badge variant={e.confidence==='confirmed'?'default':'secondary'}>{e.confidence==='confirmed'?'公司已确认':'预计 · 未确认'}</Badge>
        <span>{e.session==='unknown'?'北京时间待确认':`北京 ${reminder.viewDateLabel}${reminder.viewTimeLabel}`}</span>
        <span className="text-muted-foreground">{e.confidence==='confirmed'?reminder.countdownLabel:`预计${reminder.countdownLabel}`}</span>
        <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">{e.source}</a>
        <small className="text-muted-foreground">核验 {new Date(e.checkedAt).toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai'})}{stale?' · 超过48小时，待复核':''}</small>
      </li>})}
    </ul>}
    <p className="text-xs text-muted-foreground">预计日期可能调整；公司未公告时无法保证提前一个月确定日期。以来源公告为准。</p>
  </section>;
}
