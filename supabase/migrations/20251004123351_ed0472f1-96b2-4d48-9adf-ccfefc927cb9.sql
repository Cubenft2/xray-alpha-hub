-- Ensure MYX uses USD pair on TradingView and add MYXUSDT on MEXC

-- Update existing MYX mapping to CRYPTO:MYXUSD
UPDATE public.ticker_mappings
SET type = 'crypto',
    tradingview_symbol = 'CRYPTO:MYXUSD',
    updated_at = now()
WHERE symbol = 'MYX';

-- Upsert MYXUSDT mapping pointing to MEXC:MYXUSDT
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.ticker_mappings WHERE symbol = 'MYXUSDT') THEN
    UPDATE public.ticker_mappings
    SET type = 'crypto',
        display_name = COALESCE(display_name, 'MYX (USDT)'),
        tradingview_symbol = 'MEXC:MYXUSDT',
        is_active = true,
        updated_at = now()
    WHERE symbol = 'MYXUSDT';
  ELSE
    INSERT INTO public.ticker_mappings (symbol, display_name, type, tradingview_symbol, is_active)
    VALUES ('MYXUSDT', 'MYX (USDT)', 'crypto', 'MEXC:MYXUSDT', true);
  END IF;
END $$;
