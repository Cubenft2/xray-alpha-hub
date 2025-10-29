-- Comprehensive ticker mappings fix for social sentiment tokens
-- Fixing incorrect exchange mappings, CoinGecko IDs, and trading pairs

-- AI Agent Tokens (High Priority - Frequently in Social Sentiment)
UPDATE ticker_mappings SET 
  display_name = 'ai16z (AI16Z)',
  tradingview_symbol = 'OKX:AI16ZUSDT',
  coingecko_id = 'ai16z',
  exchange = 'OKX',
  preferred_exchange = 'OKX',
  updated_at = now()
WHERE symbol = 'AI16Z';

UPDATE ticker_mappings SET 
  display_name = 'Eliza (ELIZA)',
  tradingview_symbol = 'GATE:ELIZAUSDT',
  coingecko_id = 'eliza',
  exchange = 'Gate.io',
  preferred_exchange = 'Gate.io',
  updated_at = now()
WHERE symbol = 'ELIZA';

UPDATE ticker_mappings SET 
  display_name = 'Zerebro (ZEREBRO)',
  tradingview_symbol = 'MEXC:ZEREBROUSDT',
  coingecko_id = 'zerebro',
  exchange = 'MEXC',
  preferred_exchange = 'MEXC',
  updated_at = now()
WHERE symbol = 'ZEREBRO';

UPDATE ticker_mappings SET 
  display_name = 'Virtuals Protocol (VIRTUAL)',
  tradingview_symbol = 'BYBIT:VIRTUALUSDT',
  coingecko_id = 'virtuals-protocol',
  exchange = 'Bybit',
  preferred_exchange = 'Bybit',
  updated_at = now()
WHERE symbol = 'VIRTUAL';

UPDATE ticker_mappings SET 
  display_name = 'Goatseus Maximus (GOAT)',
  tradingview_symbol = 'OKX:GOATUSDT',
  coingecko_id = 'goatseus-maximus',
  exchange = 'OKX',
  preferred_exchange = 'OKX',
  updated_at = now()
WHERE symbol = 'GOAT';

UPDATE ticker_mappings SET 
  display_name = 'Fartcoin (FARTCOIN)',
  tradingview_symbol = 'OKX:FARTCOINUSDT',
  coingecko_id = 'fartcoin',
  exchange = 'OKX',
  preferred_exchange = 'OKX',
  updated_at = now()
WHERE symbol = 'FARTCOIN';

UPDATE ticker_mappings SET 
  display_name = 'Gigachad (GIGA)',
  tradingview_symbol = 'OKX:GIGAUSDT',
  coingecko_id = 'gigachad-2',
  exchange = 'OKX',
  preferred_exchange = 'OKX',
  updated_at = now()
WHERE symbol = 'GIGA';

UPDATE ticker_mappings SET 
  display_name = 'Griffain (GRIFFAIN)',
  tradingview_symbol = 'MEXC:GRIFFAINUSDT',
  coingecko_id = 'griffain',
  exchange = 'MEXC',
  preferred_exchange = 'MEXC',
  updated_at = now()
WHERE symbol = 'GRIFFAIN';

UPDATE ticker_mappings SET 
  display_name = 'Just a chill guy (CHILLGUY)',
  tradingview_symbol = 'OKX:CHILLGUYUSDT',
  coingecko_id = 'just-a-chill-guy',
  exchange = 'OKX',
  preferred_exchange = 'OKX',
  updated_at = now()
WHERE symbol = 'CHILLGUY';

-- Fix ASTER (Astar Network)
UPDATE ticker_mappings SET 
  display_name = 'Astar (ASTR)',
  tradingview_symbol = 'BINANCE:ASTRUSDT',
  coingecko_id = 'astar',
  exchange = 'Binance',
  preferred_exchange = 'Binance',
  updated_at = now()
WHERE symbol = 'ASTER' OR symbol = 'ASTR';

-- Other Popular Tokens from Social Sentiment
UPDATE ticker_mappings SET 
  display_name = 'Peanut the Squirrel (PNUT)',
  tradingview_symbol = 'BINANCE:PNUTUSDT',
  coingecko_id = 'peanut-the-squirrel',
  exchange = 'Binance',
  preferred_exchange = 'Binance',
  updated_at = now()
WHERE symbol = 'PNUT';

UPDATE ticker_mappings SET 
  display_name = 'Moo Deng (MOODENG)',
  tradingview_symbol = 'OKX:MOODENGUSDT',
  coingecko_id = 'moo-deng',
  exchange = 'OKX',
  preferred_exchange = 'OKX',
  updated_at = now()
WHERE symbol = 'MOODENG';

UPDATE ticker_mappings SET 
  display_name = 'Act I : The AI Prophecy (ACT)',
  tradingview_symbol = 'BINANCE:ACTUSDT',
  coingecko_id = 'act-i-the-ai-prophecy',
  exchange = 'Binance',
  preferred_exchange = 'Binance',
  updated_at = now()
WHERE symbol = 'ACT';

UPDATE ticker_mappings SET 
  display_name = 'Aerodrome Finance (AERO)',
  tradingview_symbol = 'COINBASE:AEROUSD',
  coingecko_id = 'aerodrome-finance',
  exchange = 'Coinbase',
  preferred_exchange = 'Coinbase',
  updated_at = now()
WHERE symbol = 'AERO';

UPDATE ticker_mappings SET 
  display_name = 'Pudgy Penguins (PENGU)',
  tradingview_symbol = 'BINANCE:PENGUUSDT',
  coingecko_id = 'pudgy-penguins',
  exchange = 'Binance',
  preferred_exchange = 'Binance',
  updated_at = now()
WHERE symbol = 'PENGU';

UPDATE ticker_mappings SET 
  display_name = 'Movement (MOVE)',
  tradingview_symbol = 'BINANCE:MOVEUSDT',
  coingecko_id = 'movement',
  exchange = 'Binance',
  preferred_exchange = 'Binance',
  updated_at = now()
WHERE symbol = 'MOVE';

UPDATE ticker_mappings SET 
  display_name = 'Hyperliquid (HYPE)',
  tradingview_symbol = 'BYBIT:HYPEUSDT',
  coingecko_id = 'hyperliquid',
  exchange = 'Bybit',
  preferred_exchange = 'Bybit',
  updated_at = now()
WHERE symbol = 'HYPE';

UPDATE ticker_mappings SET 
  display_name = 'Usual (USUAL)',
  tradingview_symbol = 'BINANCE:USUALUSDT',
  coingecko_id = 'usual',
  exchange = 'Binance',
  preferred_exchange = 'Binance',
  updated_at = now()
WHERE symbol = 'USUAL';

UPDATE ticker_mappings SET 
  display_name = 'Vana (VANA)',
  tradingview_symbol = 'BINANCE:VANAUSDT',
  coingecko_id = 'vana',
  exchange = 'Binance',
  preferred_exchange = 'Binance',
  updated_at = now()
WHERE symbol = 'VANA';

UPDATE ticker_mappings SET 
  display_name = 'Grass (GRASS)',
  tradingview_symbol = 'BYBIT:GRASSUSDT',
  coingecko_id = 'grass',
  exchange = 'Bybit',
  preferred_exchange = 'Bybit',
  updated_at = now()
WHERE symbol = 'GRASS';

-- Add audit comment
COMMENT ON TABLE ticker_mappings IS 'Comprehensive fix applied 2025-10-29: Corrected exchange mappings, CoinGecko IDs, and trading pairs for 20+ tokens appearing in social sentiment data';