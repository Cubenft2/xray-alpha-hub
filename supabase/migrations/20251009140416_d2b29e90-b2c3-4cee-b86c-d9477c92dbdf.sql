-- Update morning brief schedule to 5:30 AM EDT (4 hours before market open)
SELECT cron.alter_job(
  job_id := 17,
  schedule := '30 5 * * 1-6'
);