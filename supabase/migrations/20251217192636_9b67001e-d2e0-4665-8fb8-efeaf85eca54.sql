UPDATE api_rate_limits 
SET daily_limit = 16666, 
    description = 'CoinGecko Pro API - 500/min, 500k/month'
WHERE api_name = 'coingecko';