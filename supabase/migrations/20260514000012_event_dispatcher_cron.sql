-- ── Retry cron: call event-dispatcher every minute ───────────────────────────
-- automation_events with status='pending' can get stuck when the fire-and-forget
-- webhook call fails. This cron job ensures they are always retried within 1 minute.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Remove existing job if it was set up under a different name to avoid duplicates
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN ('retry-pending-automation-events', 'event-dispatcher-retry');

SELECT cron.schedule(
  'event-dispatcher-retry',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://tapbwlmdvluqdgvixkxf.supabase.co/functions/v1/event-dispatcher',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhcGJ3bG1kdmx1cWRndml4a3hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2MDY0NDgsImV4cCI6MjA3MDE4MjQ0OH0.U2p9jneQ6Lcgu672Z8W-KnKhLgMLygDk1jB4a0YIwvQ"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id
  WHERE EXISTS (
    SELECT 1 FROM public.automation_events
    WHERE status = 'pending'
      AND created_at < now() - interval '30 seconds'
  );
  $$
);
