-- Create ticker_mappings table for centralized ticker configuration
CREATE TABLE public.ticker_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('crypto', 'stock', 'index', 'forex', 'dex')),
  exchange TEXT,
  tradingview_symbol TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ticker_mappings ENABLE ROW LEVEL SECURITY;

-- Allow public read access to active ticker mappings
CREATE POLICY "Allow public read access to active ticker mappings"
ON public.ticker_mappings
FOR SELECT
USING (is_active = true);

-- Allow service role full access
CREATE POLICY "Allow service role full access to ticker_mappings"
ON public.ticker_mappings
FOR ALL
USING (true)
WITH CHECK (true);

-- Create updated_at trigger
CREATE TRIGGER update_ticker_mappings_updated_at
BEFORE UPDATE ON public.ticker_mappings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_ticker_mappings_symbol ON public.ticker_mappings(symbol);
CREATE INDEX idx_ticker_mappings_type ON public.ticker_mappings(type);

-- Insert initial data from the config file
-- Tech Stocks
INSERT INTO public.ticker_mappings (symbol, display_name, type, exchange, tradingview_symbol) VALUES
('AAPL', 'Apple Inc. (AAPL)', 'stock', 'NASDAQ', 'NASDAQ:AAPL'),
('MSFT', 'Microsoft (MSFT)', 'stock', 'NASDAQ', 'NASDAQ:MSFT'),
('GOOGL', 'Alphabet (GOOGL)', 'stock', 'NASDAQ', 'NASDAQ:GOOGL'),
('AMZN', 'Amazon (AMZN)', 'stock', 'NASDAQ', 'NASDAQ:AMZN'),
('META', 'Meta Platforms (META)', 'stock', 'NASDAQ', 'NASDAQ:META'),
('TSLA', 'Tesla (TSLA)', 'stock', 'NASDAQ', 'NASDAQ:TSLA'),
('NVDA', 'NVIDIA (NVDA)', 'stock', 'NASDAQ', 'NASDAQ:NVDA'),
('NFLX', 'Netflix (NFLX)', 'stock', 'NASDAQ', 'NASDAQ:NFLX'),
('AMD', 'AMD (AMD)', 'stock', 'NASDAQ', 'NASDAQ:AMD'),
('INTC', 'Intel (INTC)', 'stock', 'NASDAQ', 'NASDAQ:INTC'),
('ADBE', 'Adobe (ADBE)', 'stock', 'NASDAQ', 'NASDAQ:ADBE'),
('QCOM', 'Qualcomm (QCOM)', 'stock', 'NASDAQ', 'QCOM'),
('AVGO', 'Broadcom (AVGO)', 'stock', 'NASDAQ', 'NASDAQ:AVGO'),

-- Crypto/Blockchain Stocks
('COIN', 'Coinbase (COIN)', 'stock', 'NASDAQ', 'NASDAQ:COIN'),
('MSTR', 'MicroStrategy (MSTR)', 'stock', 'NASDAQ', 'NASDAQ:MSTR'),
('MARA', 'Marathon Digital (MARA)', 'stock', 'NASDAQ', 'NASDAQ:MARA'),
('RIOT', 'Riot Platforms (RIOT)', 'stock', 'NASDAQ', 'NASDAQ:RIOT'),
('CLSK', 'CleanSpark (CLSK)', 'stock', 'NASDAQ', 'NASDAQ:CLSK'),
('HUT', 'Hut 8 Mining (HUT)', 'stock', 'NASDAQ', 'NASDAQ:HUT'),
('BITF', 'Bitfarms (BITF)', 'stock', 'NASDAQ', 'NASDAQ:BITF'),
('HOOD', 'Robinhood (HOOD)', 'stock', 'NASDAQ', 'NASDAQ:HOOD'),

-- NYSE Stocks
('CRM', 'Salesforce (CRM)', 'stock', 'NYSE', 'NYSE:CRM'),
('ORCL', 'Oracle (ORCL)', 'stock', 'NYSE', 'NYSE:ORCL'),
('IBM', 'IBM (IBM)', 'stock', 'NYSE', 'NYSE:IBM'),
('SNAP', 'Snap Inc. (SNAP)', 'stock', 'NYSE', 'NYSE:SNAP'),
('BBAI', 'BigBear.ai (BBAI)', 'stock', 'NYSE', 'NYSE:BBAI'),

-- Other Stocks
('EA', 'Electronic Arts (EA)', 'stock', 'NASDAQ', 'NASDAQ:EA'),
('MNPR', 'Monopar Therapeutics (MNPR)', 'stock', 'NASDAQ', 'NASDAQ:MNPR'),
('SBUX', 'Starbucks (SBUX)', 'stock', 'NASDAQ', 'NASDAQ:SBUX'),
('PYPL', 'PayPal (PYPL)', 'stock', 'NASDAQ', 'NASDAQ:PYPL'),
('SQ', 'Block/Square (SQ)', 'stock', 'NASDAQ', 'NASDAQ:SQ'),

-- ETFs
('SPY', 'S&P 500 ETF (SPY)', 'stock', 'AMEX', 'AMEX:SPY'),
('QQQ', 'Nasdaq 100 ETF (QQQ)', 'stock', 'NASDAQ', 'NASDAQ:QQQ'),

-- Major Cryptocurrencies
('BTC', 'Bitcoin (BTC)', 'crypto', 'COINBASE', 'COINBASE:BTCUSD'),
('ETH', 'Ethereum (ETH)', 'crypto', 'COINBASE', 'COINBASE:ETHUSD'),
('SOL', 'Solana (SOL)', 'crypto', 'COINBASE', 'COINBASE:SOLUSD'),
('AVAX', 'Avalanche (AVAX)', 'crypto', 'BINANCE', 'BINANCE:AVAXUSDT'),
('ADA', 'Cardano (ADA)', 'crypto', 'BINANCE', 'BINANCE:ADAUSDT'),
('XRP', 'Ripple (XRP)', 'crypto', 'BINANCE', 'BINANCE:XRPUSDT'),
('DOGE', 'Dogecoin (DOGE)', 'crypto', 'BINANCE', 'BINANCE:DOGEUSDT'),
('MATIC', 'Polygon (MATIC)', 'crypto', 'COINBASE', 'COINBASE:MATICUSD'),
('DOT', 'Polkadot (DOT)', 'crypto', 'BINANCE', 'BINANCE:DOTUSDT'),
('LINK', 'Chainlink (LINK)', 'crypto', 'BINANCE', 'BINANCE:LINKUSDT'),
('UNI', 'Uniswap (UNI)', 'crypto', 'BINANCE', 'BINANCE:UNIUSDT'),
('ATOM', 'Cosmos (ATOM)', 'crypto', 'CRYPTO', 'ATOMUSD'),
('HYPE', 'Hyperliquid (HYPE)', 'crypto', 'CRYPTO', 'HYPEUSD'),
('SUI', 'Sui (SUI)', 'crypto', 'CRYPTO', 'SUIUSD'),
('TRX', 'Tron (TRX)', 'crypto', 'COINBASE', 'COINBASE:TRXUSD'),
('USDT', 'Tether (USDT)', 'crypto', 'BINANCE', 'BINANCE:USDTUSD'),
('RNDR', 'Render Token (RNDR)', 'crypto', 'GEMINI', 'GEMINI:RNDRUSD'),
('FLR', 'Flare (FLR)', 'crypto', 'CRYPTO', 'FLRUSD'),

-- DEX Tokens
('CAKE', 'PancakeSwap (CAKE)', 'dex', 'BINANCE', 'BINANCE:CAKEUSDT'),
('SUSHI', 'SushiSwap (SUSHI)', 'dex', 'BINANCE', 'BINANCE:SUSHIUSDT'),
('CRV', 'Curve DAO (CRV)', 'dex', 'BINANCE', 'BINANCE:CRVUSDT'),
('BAL', 'Balancer (BAL)', 'dex', 'BINANCE', 'BINANCE:BALUSDT'),
('AAVE', 'Aave (AAVE)', 'dex', 'BINANCE', 'BINANCE:AAVEUSDT'),
('COMP', 'Compound (COMP)', 'dex', 'BINANCE', 'BINANCE:COMPUSDT'),
('GMX', 'GMX (GMX)', 'dex', 'BINANCE', 'BINANCE:GMXUSDT'),
('DYDX', 'dYdX (DYDX)', 'dex', 'BINANCE', 'BINANCE:DYDXUSDT'),
('1INCH', '1inch (1INCH)', 'dex', 'BINANCE', 'BINANCE:1INCHUSDT'),

-- Indices and Forex
('SPX', 'S&P 500 (SPY)', 'index', NULL, 'SPY'),
('DXY', 'US Dollar Index', 'forex', NULL, 'DXY'),
('XAUUSD', 'Gold (XAU/USD)', 'forex', NULL, 'XAUUSD');