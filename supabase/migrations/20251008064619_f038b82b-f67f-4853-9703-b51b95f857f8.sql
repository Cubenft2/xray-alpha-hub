-- Schedule SSE listener restart every hour
SELECT cron.schedule(
  'lunarcrush-sse-restart',
  '5 * * * *', -- Every hour at minute 5 (offset from sync)
  $$
  SELECT
    net.http_post(
        url:='https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/lunarcrush-sse-listener',
        headers:=jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret', true)
        ),
        body:=jsonb_build_object('time', now())
    ) as request_id;
  $$
);