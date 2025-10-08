-- Schedule LunarCrush sync to run every hour
SELECT cron.schedule(
  'lunarcrush-hourly-sync',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT
    net.http_post(
        url:='https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/lunarcrush-sync',
        headers:=jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret', true)
        ),
        body:=jsonb_build_object('time', now())
    ) as request_id;
  $$
);