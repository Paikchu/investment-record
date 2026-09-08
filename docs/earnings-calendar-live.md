# Live earnings calendar

The existing `max-investment-record-sec-cron` Worker runs `15 * * * *` (UTC).
It calls the website's authenticated POST `/api/internal/earnings/refresh` through
`PORTFOLIO_SITE`, using the existing server-only `PORTFOLIO_SYNC_KEY`. The IBKR
schedule remains separate and unchanged. No earnings request writes portfolio data.

The website reads live held symbols and stores the calendar in D1
`earnings_calendar_state`. The first successful sweep each Beijing day covers one
calendar month (month-end clamped); other sweeps cover the next seven days. Failed
dates retain their original observations and verification times. Missing payloads
are not treated as successful empty calendars. The browser polls the public read
endpoint `/api/earnings` every five minutes and filters reminders to one month.

Nasdaq's calendar does not provide a reliable confirmation flag, so those dates
are always estimated. Reviewed company announcements in `officialAnnouncements`
take precedence and link to the actual official evidence. Currently ORCL's September
2026 announcement is independently verified; this registry is deliberately explicit,
not an automated claim that every company announcement has been verified. Adding a
new confirmed date requires checking its company announcement and recording the
actual verification timestamp. Unknown/unannounced dates must not be invented.

The panel displays source, verification date, latest attempt, partial failures and
observations older than 48 hours. Announcement dates can change; confirmation is
source provenance, not a guarantee against subsequent rescheduling.

Apply `drizzle/0007_earnings_calendar.sql` through the normal deployment migration
step. After deployment, an authorized POST to the refresh endpoint can bootstrap
state without waiting for Cron propagation. The endpoint has a five-minute cooldown.
