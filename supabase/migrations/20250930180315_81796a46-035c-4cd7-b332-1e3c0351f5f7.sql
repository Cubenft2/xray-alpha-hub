-- Clear stale cache entries for updated symbols
DELETE FROM public.cache_kv 
WHERE k LIKE '%KAITO%' 
   OR k LIKE '%SUPER%' 
   OR k LIKE '%0G%'
   OR k LIKE '%ATH%'
   OR k LIKE '%XPL%'
   OR k LIKE '%WEETH%'
   OR k LIKE '%WETH%'
   OR k LIKE '%WBETH%';