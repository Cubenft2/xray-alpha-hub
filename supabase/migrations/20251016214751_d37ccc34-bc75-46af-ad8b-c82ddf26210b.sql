-- Fix BAS (BNB Attestation Service) to use COINBASE with USD
UPDATE ticker_mappings
SET 
  tradingview_symbol = 'COINBASE:BASUSD',
  polygon_ticker = 'X:BASUSD',
  display_name = 'BNB Attestation Service',
  updated_at = now()
WHERE symbol = 'BAS';

-- Fix PAXG (PAX Gold) to use COINBASE with PAXUSD
UPDATE ticker_mappings
SET 
  tradingview_symbol = 'COINBASE:PAXUSD',
  polygon_ticker = 'X:PAXUSD',
  coingecko_id = 'paxos-standard',
  display_name = 'Paxos',
  updated_at = now()
WHERE symbol = 'PAXG';