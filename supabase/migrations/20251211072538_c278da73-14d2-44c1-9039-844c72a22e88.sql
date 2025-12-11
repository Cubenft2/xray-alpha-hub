-- Delete old stale records that haven't been updated by LunarCrush
DELETE FROM crypto_snapshot 
WHERE updated_at < '2025-12-11 07:00:00'::timestamptz;