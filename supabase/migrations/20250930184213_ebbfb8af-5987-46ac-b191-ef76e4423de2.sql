-- Correct Aethir (ATH) TradingView mapping: clear invalid symbol and disable tv flag
UPDATE public.ticker_mappings
SET tradingview_symbol = '',
    tradingview_supported = false,
    updated_at = now()
WHERE symbol = 'ATH';