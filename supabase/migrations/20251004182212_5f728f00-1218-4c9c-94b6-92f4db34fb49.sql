-- Update site_settings to include all 60+ crypto tickers for Polygon streaming
-- Extracting unique base symbols from XRTicker and formatting for Polygon (X:SYMBOL format)

INSERT INTO site_settings (setting_key, setting_value)
VALUES (
  'ticker_list',
  jsonb_build_object(
    'crypto', jsonb_build_array(
      'X:BTCUSD', 'X:ETHUSD', 'X:BNBUSD', 'X:SOLUSD', 'X:XRPUSD', 
      'X:ADAUSD', 'X:AVAXUSD', 'X:DOGEUSD', 'X:SHIBUSD', 'X:LINKUSD',
      'X:DOTUSD', 'X:UNIUSD', 'X:MATICUSD', 'X:LTCUSD', 'X:BCHUSD',
      'X:ATOMUSD', 'X:FILUSD', 'X:XLMUSD', 'X:ALGOUSD', 'X:MANAUSD',
      'X:SANDUSD', 'X:CHZUSD', 'X:NEARUSD', 'X:AXSUSD', 'X:COMPUSD',
      'X:MKRUSD', 'X:AAVEUSD', 'X:SNXUSD', 'X:YFIUSD', 'X:CRVUSD',
      'X:ENJUSD', 'X:GALAUSD', 'X:FLOWUSD', 'X:ICPUSD', 'X:FETUSD',
      'X:PEPEUSD', 'X:BONKUSD', 'X:WIFUSD', 'X:ARBUSD', 'X:RNDRUSD',
      'X:TONUSD', 'X:TRXUSD', 'X:ZETAUSD', 'X:SUIUSD', 'X:CETUSUSD',
      'X:HYPEUSD', 'X:OKBUSD', 'X:ONDOUSD', 'X:SEIUSD', 'X:JUPUSD',
      'X:FLRUSD', 'X:OPUSD', 'X:WLFIUSD', 'X:PENGUUSD', 'X:AVNTUSD',
      'X:ASPERUSD', 'X:ASTERUSD', 'X:ASTRUSD'
    ),
    'enabled', true
  )
)
ON CONFLICT (setting_key)
DO UPDATE SET 
  setting_value = EXCLUDED.setting_value,
  updated_at = now();