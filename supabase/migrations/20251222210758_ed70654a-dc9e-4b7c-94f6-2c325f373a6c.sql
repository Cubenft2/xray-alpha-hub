-- Add deprecation comment to crypto_snapshot table
COMMENT ON TABLE crypto_snapshot IS 'DEPRECATED: This table is no longer actively maintained. Use token_cards table instead which combines data from all sources (CoinGecko, LunarCrush, Polygon). The crypto_snapshot table was populated by lunarcrush-sync which is now disabled.';

-- Clear the junk data from news_cache (homepage titles instead of articles)
DELETE FROM news_cache WHERE url IS NULL OR url = '' OR title LIKE '%Bitcoin, Ethereum, XRP%' OR title LIKE '%Crypto News and Price Data%' OR title LIKE '%Live Prices, Data%';