/**
 * Centralized Ticker Mappings Configuration
 * 
 * IMPORTANT: Keep this file updated to prevent incorrect ticker formatting
 * which wastes credits and causes incorrect chart displays.
 */

export interface TickerMapping {
  symbol: string;
  displayName: string;
  type: 'crypto' | 'stock' | 'index' | 'forex';
}

// Known stock tickers - ALWAYS use EXCHANGE:SYMBOL format
export const STOCK_TICKERS: Record<string, TickerMapping> = {
  // Tech Stocks
  'AAPL': { symbol: 'NASDAQ:AAPL', displayName: 'Apple Inc. (AAPL)', type: 'stock' },
  'MSFT': { symbol: 'NASDAQ:MSFT', displayName: 'Microsoft (MSFT)', type: 'stock' },
  'GOOGL': { symbol: 'NASDAQ:GOOGL', displayName: 'Alphabet (GOOGL)', type: 'stock' },
  'GOOGLE': { symbol: 'NASDAQ:GOOGL', displayName: 'Alphabet (GOOGL)', type: 'stock' },
  'GOOG': { symbol: 'NASDAQ:GOOG', displayName: 'Alphabet Class C (GOOG)', type: 'stock' },
  'AMZN': { symbol: 'NASDAQ:AMZN', displayName: 'Amazon (AMZN)', type: 'stock' },
  'AMAZON': { symbol: 'NASDAQ:AMZN', displayName: 'Amazon (AMZN)', type: 'stock' },
  'META': { symbol: 'NASDAQ:META', displayName: 'Meta Platforms (META)', type: 'stock' },
  'FACEBOOK': { symbol: 'NASDAQ:META', displayName: 'Meta Platforms (META)', type: 'stock' },
  'TSLA': { symbol: 'NASDAQ:TSLA', displayName: 'Tesla (TSLA)', type: 'stock' },
  'TESLA': { symbol: 'NASDAQ:TSLA', displayName: 'Tesla (TSLA)', type: 'stock' },
  'NVDA': { symbol: 'NASDAQ:NVDA', displayName: 'NVIDIA (NVDA)', type: 'stock' },
  'NVIDIA': { symbol: 'NASDAQ:NVDA', displayName: 'NVIDIA (NVDA)', type: 'stock' },
  'NFLX': { symbol: 'NASDAQ:NFLX', displayName: 'Netflix (NFLX)', type: 'stock' },
  'NETFLIX': { symbol: 'NASDAQ:NFLX', displayName: 'Netflix (NFLX)', type: 'stock' },
  'AMD': { symbol: 'NASDAQ:AMD', displayName: 'AMD (AMD)', type: 'stock' },
  'INTC': { symbol: 'NASDAQ:INTC', displayName: 'Intel (INTC)', type: 'stock' },
  'INTEL': { symbol: 'NASDAQ:INTC', displayName: 'Intel (INTC)', type: 'stock' },
  'ADBE': { symbol: 'NASDAQ:ADBE', displayName: 'Adobe (ADBE)', type: 'stock' },
  'ADOBE': { symbol: 'NASDAQ:ADBE', displayName: 'Adobe (ADBE)', type: 'stock' },
  'QCOM': { symbol: 'NASDAQ:QCOM', displayName: 'Qualcomm (QCOM)', type: 'stock' },
  'AVGO': { symbol: 'NASDAQ:AVGO', displayName: 'Broadcom (AVGO)', type: 'stock' },
  
  // Crypto/Blockchain Related Stocks
  'COIN': { symbol: 'NASDAQ:COIN', displayName: 'Coinbase (COIN)', type: 'stock' },
  'COINBASE': { symbol: 'NASDAQ:COIN', displayName: 'Coinbase (COIN)', type: 'stock' },
  'MSTR': { symbol: 'NASDAQ:MSTR', displayName: 'MicroStrategy (MSTR)', type: 'stock' },
  'MICROSTRATEGY': { symbol: 'NASDAQ:MSTR', displayName: 'MicroStrategy (MSTR)', type: 'stock' },
  'MARA': { symbol: 'NASDAQ:MARA', displayName: 'Marathon Digital (MARA)', type: 'stock' },
  'RIOT': { symbol: 'NASDAQ:RIOT', displayName: 'Riot Platforms (RIOT)', type: 'stock' },
  'CLSK': { symbol: 'NASDAQ:CLSK', displayName: 'CleanSpark (CLSK)', type: 'stock' },
  'HUT': { symbol: 'NASDAQ:HUT', displayName: 'Hut 8 Mining (HUT)', type: 'stock' },
  'BITF': { symbol: 'NASDAQ:BITF', displayName: 'Bitfarms (BITF)', type: 'stock' },
  'HOOD': { symbol: 'NASDAQ:HOOD', displayName: 'Robinhood (HOOD)', type: 'stock' },
  'ROBINHOOD': { symbol: 'NASDAQ:HOOD', displayName: 'Robinhood (HOOD)', type: 'stock' },
  
  // NYSE Stocks
  'CRM': { symbol: 'NYSE:CRM', displayName: 'Salesforce (CRM)', type: 'stock' },
  'SALESFORCE': { symbol: 'NYSE:CRM', displayName: 'Salesforce (CRM)', type: 'stock' },
  'ORCL': { symbol: 'NYSE:ORCL', displayName: 'Oracle (ORCL)', type: 'stock' },
  'ORACLE': { symbol: 'NYSE:ORCL', displayName: 'Oracle (ORCL)', type: 'stock' },
  'IBM': { symbol: 'NYSE:IBM', displayName: 'IBM (IBM)', type: 'stock' },
  'SNAP': { symbol: 'NYSE:SNAP', displayName: 'Snap Inc. (SNAP)', type: 'stock' },
  'SNAPCHAT': { symbol: 'NYSE:SNAP', displayName: 'Snap Inc. (SNAP)', type: 'stock' },
  'BBAI': { symbol: 'NYSE:BBAI', displayName: 'BigBear.ai (BBAI)', type: 'stock' },
  'NKE': { symbol: 'NYSE:NKE', displayName: 'Nike (NKE)', type: 'stock' },
  'NIKE': { symbol: 'NYSE:NKE', displayName: 'Nike (NKE)', type: 'stock' },
  'PFE': { symbol: 'NYSE:PFE', displayName: 'Pfizer (PFE)', type: 'stock' },
  'PFIZER': { symbol: 'NYSE:PFE', displayName: 'Pfizer (PFE)', type: 'stock' },
  'LAC': { symbol: 'NYSE:PFE', displayName: 'Pfizer (PFE)', type: 'stock' },
  'NX': { symbol: 'NYSE:NX', displayName: 'Quanex Building Products (NX)', type: 'stock' },
  
  // Other Stocks
  'EA': { symbol: 'NASDAQ:EA', displayName: 'Electronic Arts (EA)', type: 'stock' },
  'MNPR': { symbol: 'NASDAQ:MNPR', displayName: 'Monopar Therapeutics (MNPR)', type: 'stock' },
  'MONOPAR': { symbol: 'NASDAQ:MNPR', displayName: 'Monopar Therapeutics (MNPR)', type: 'stock' },
  'SBUX': { symbol: 'NASDAQ:SBUX', displayName: 'Starbucks (SBUX)', type: 'stock' },
  'STARBUCKS': { symbol: 'NASDAQ:SBUX', displayName: 'Starbucks (SBUX)', type: 'stock' },
  'PYPL': { symbol: 'NASDAQ:PYPL', displayName: 'PayPal (PYPL)', type: 'stock' },
  'PAYPAL': { symbol: 'NASDAQ:PYPL', displayName: 'PayPal (PYPL)', type: 'stock' },
  'SQ': { symbol: 'NASDAQ:SQ', displayName: 'Block/Square (SQ)', type: 'stock' },
  'SQUARE': { symbol: 'NASDAQ:SQ', displayName: 'Block/Square (SQ)', type: 'stock' },
  'PUBM': { symbol: 'NASDAQ:PUBM', displayName: 'PubMatic (PUBM)', type: 'stock' },
  'VZ': { symbol: 'NYSE:VZ', displayName: 'Verizon Communications (VZ)', type: 'stock' },
  'VERIZON': { symbol: 'NYSE:VZ', displayName: 'Verizon Communications (VZ)', type: 'stock' },
  'FRSX': { symbol: 'NASDAQ:FRSX', displayName: 'Foresight Autonomous Holdings (FRSX)', type: 'stock' },
  'FORESIGHT': { symbol: 'NASDAQ:FRSX', displayName: 'Foresight Autonomous Holdings (FRSX)', type: 'stock' },
  
  // ETFs
  'SPY': { symbol: 'AMEX:SPY', displayName: 'S&P 500 ETF (SPY)', type: 'stock' },
  'QQQ': { symbol: 'NASDAQ:QQQ', displayName: 'Nasdaq 100 ETF (QQQ)', type: 'stock' },
};

// Crypto tickers - use exchange:pair or just pair format
export const CRYPTO_TICKERS: Record<string, TickerMapping> = {
  'BTC': { symbol: 'COINBASE:BTCUSD', displayName: 'Bitcoin (BTC)', type: 'crypto' },
  'BITCOIN': { symbol: 'COINBASE:BTCUSD', displayName: 'Bitcoin (BTC)', type: 'crypto' },
  'ETH': { symbol: 'COINBASE:ETHUSD', displayName: 'Ethereum (ETH)', type: 'crypto' },
  'ETHEREUM': { symbol: 'COINBASE:ETHUSD', displayName: 'Ethereum (ETH)', type: 'crypto' },
  'SOL': { symbol: 'COINBASE:SOLUSD', displayName: 'Solana (SOL)', type: 'crypto' },
  'SOLANA': { symbol: 'COINBASE:SOLUSD', displayName: 'Solana (SOL)', type: 'crypto' },
  'AVAX': { symbol: 'BINANCE:AVAXUSDT', displayName: 'Avalanche (AVAX)', type: 'crypto' },
  'AVALANCHE': { symbol: 'BINANCE:AVAXUSDT', displayName: 'Avalanche (AVAX)', type: 'crypto' },
  'ADA': { symbol: 'BINANCE:ADAUSDT', displayName: 'Cardano (ADA)', type: 'crypto' },
  'CARDANO': { symbol: 'BINANCE:ADAUSDT', displayName: 'Cardano (ADA)', type: 'crypto' },
  'XRP': { symbol: 'BINANCE:XRPUSDT', displayName: 'Ripple (XRP)', type: 'crypto' },
  'RIPPLE': { symbol: 'BINANCE:XRPUSDT', displayName: 'Ripple (XRP)', type: 'crypto' },
  'DOGE': { symbol: 'BINANCE:DOGEUSDT', displayName: 'Dogecoin (DOGE)', type: 'crypto' },
  'DOGECOIN': { symbol: 'BINANCE:DOGEUSDT', displayName: 'Dogecoin (DOGE)', type: 'crypto' },
  'MATIC': { symbol: 'COINBASE:MATICUSD', displayName: 'Polygon (MATIC)', type: 'crypto' },
  'POLYGON': { symbol: 'COINBASE:MATICUSD', displayName: 'Polygon (MATIC)', type: 'crypto' },
  'DOT': { symbol: 'BINANCE:DOTUSDT', displayName: 'Polkadot (DOT)', type: 'crypto' },
  'POLKADOT': { symbol: 'BINANCE:DOTUSDT', displayName: 'Polkadot (DOT)', type: 'crypto' },
  'LINK': { symbol: 'BINANCE:LINKUSDT', displayName: 'Chainlink (LINK)', type: 'crypto' },
  'CHAINLINK': { symbol: 'BINANCE:LINKUSDT', displayName: 'Chainlink (LINK)', type: 'crypto' },
  'UNI': { symbol: 'BINANCE:UNIUSDT', displayName: 'Uniswap (UNI)', type: 'crypto' },
  'UNISWAP': { symbol: 'BINANCE:UNIUSDT', displayName: 'Uniswap (UNI)', type: 'crypto' },
  'ATOM': { symbol: 'ATOMUSD', displayName: 'Cosmos (ATOM)', type: 'crypto' },
  'COSMOS': { symbol: 'ATOMUSD', displayName: 'Cosmos (ATOM)', type: 'crypto' },
  'HYPE': { symbol: 'HYPEUSD', displayName: 'Hyperliquid (HYPE)', type: 'crypto' },
  'HYPERLIQUID': { symbol: 'HYPEUSD', displayName: 'Hyperliquid (HYPE)', type: 'crypto' },
  'SUI': { symbol: 'SUIUSD', displayName: 'Sui (SUI)', type: 'crypto' },
  'TRX': { symbol: 'COINBASE:TRXUSD', displayName: 'Tron (TRX)', type: 'crypto' },
  'TRON': { symbol: 'COINBASE:TRXUSD', displayName: 'Tron (TRX)', type: 'crypto' },
  'USDT': { symbol: 'BINANCE:USDTUSD', displayName: 'Tether (USDT)', type: 'crypto' },
  'TETHER': { symbol: 'BINANCE:USDTUSD', displayName: 'Tether (USDT)', type: 'crypto' },
  'RNDR': { symbol: 'GEMINI:RNDRUSD', displayName: 'Render Token (RNDR)', type: 'crypto' },
  'RENDER': { symbol: 'GEMINI:RNDRUSD', displayName: 'Render Token (RNDR)', type: 'crypto' },
  'FLR': { symbol: 'FLRUSD', displayName: 'Flare (FLR)', type: 'crypto' },
  'FLARE': { symbol: 'FLRUSD', displayName: 'Flare (FLR)', type: 'crypto' },

  // Added mappings to fix missing mini-cards
  'BNB': { symbol: 'BINANCE:BNBUSDT', displayName: 'BNB (BNB)', type: 'crypto' },
  'WETH': { symbol: 'COINBASE:ETHUSD', displayName: 'Wrapped ETH (WETH)', type: 'crypto' },
  'WEETH': { symbol: 'COINBASE:ETHUSD', displayName: 'Wrapped eETH (WEETH)', type: 'crypto' },
  'WBETH': { symbol: 'BINANCE:WBETHUSDT', displayName: 'Wrapped Beacon ETH (WBETH)', type: 'crypto' },
  'ASTR': { symbol: 'BINANCE:ASTRUSDT', displayName: 'Astar (ASTR)', type: 'crypto' },
  'ASTER': { symbol: 'MEXC:ASTERUSDT', displayName: 'Aster (ASTER)', type: 'crypto' },
  'ASTAR': { symbol: 'BINANCE:ASTRUSDT', displayName: 'Astar Network (ASTAR)', type: 'crypto' },
  'OKB': { symbol: 'OKX:OKBUSDT', displayName: 'OKX Token (OKB)', type: 'crypto' },
  'IMX': { symbol: 'BINANCE:IMXUSDT', displayName: 'Immutable X (IMX)', type: 'crypto' },
  'HASH': { symbol: 'COINBASE:HASHUSD', displayName: 'Hashflow (HASH)', type: 'crypto' },
  'FF': { symbol: 'BINANCE:FFUSDT', displayName: 'Falcon Finance (FF)', type: 'crypto' },
  // User-specified cryptos
  'BORG': { symbol: 'BORGUSD', displayName: 'SwissBorg (BORG)', type: 'crypto' },
  'XAN': { symbol: 'XANUSD', displayName: 'Anoma (XAN)', type: 'crypto' },
  'STRK': { symbol: 'BINANCE:STRKUSDT', displayName: 'Starknet (STRK)', type: 'crypto' },
  'STARKNET': { symbol: 'BINANCE:STRKUSDT', displayName: 'Starknet (STRK)', type: 'crypto' },
  'KAITO': { symbol: 'CRYPTO:KAITOUSD', displayName: 'Kaito (KAITO)', type: 'crypto' },
  'SUPER': { symbol: 'BINANCE:SUPERUSDT', displayName: 'SuperVerse (SUPER)', type: 'crypto' },
  'SUPERVERSE': { symbol: 'BINANCE:SUPERUSDT', displayName: 'SuperVerse (SUPER)', type: 'crypto' },
  '0G': { symbol: 'CRYPTO:0GUSD', displayName: '0G (0G)', type: 'crypto' },
  'ATH': { symbol: 'COINBASE:ATHUSD', displayName: 'Aethir (ATH)', type: 'crypto' },
  'AETHIR': { symbol: 'COINBASE:ATHUSD', displayName: 'Aethir (ATH)', type: 'crypto' },
  'XPL': { symbol: 'BINANCE:XPLUSDT', displayName: 'Plasma (XPL)', type: 'crypto' },
  'PLASMA': { symbol: 'BINANCE:XPLUSDT', displayName: 'Plasma (XPL)', type: 'crypto' },
  // Added to resolve admin audit missing mappings
  'ZEC': { symbol: 'BINANCE:ZECUSDT', displayName: 'Zcash (ZEC)', type: 'crypto' },
  'ZCASH': { symbol: 'BINANCE:ZECUSDT', displayName: 'Zcash (ZEC)', type: 'crypto' },
  'PUMP': { symbol: 'CRYPTO:PUMPFUSD', displayName: 'PUMP.FUN (PUMP)', type: 'crypto' },
  'PUMP.FUN': { symbol: 'CRYPTO:PUMPFUSD', displayName: 'PUMP.FUN (PUMP)', type: 'crypto' },
  'PUMPFUN': { symbol: 'CRYPTO:PUMPFUSD', displayName: 'PUMP.FUN (PUMP)', type: 'crypto' },
  'BDX': { symbol: 'CRYPTO:BDXUSD', displayName: 'Beldex (BDX)', type: 'crypto' },
  'BELDEX': { symbol: 'CRYPTO:BDXUSD', displayName: 'Beldex (BDX)', type: 'crypto' },
  'UXLINK': { symbol: 'CRYPTO:UXLINKUSD', displayName: 'UXLINK (UXLINK)', type: 'crypto' },
  'UXPL': { symbol: 'CRYPTO:UXLINKUSD', displayName: 'UXLINK (UXLINK)', type: 'crypto' },
  'AVNT': { symbol: 'COINBASE:AVNTUSD', displayName: 'Avanti (AVNT)', type: 'crypto' },
  'AVANTI': { symbol: 'COINBASE:AVNTUSD', displayName: 'Avanti (AVNT)', type: 'crypto' },
  'ZBCN': { symbol: 'CRYPTO:ZBCNUSD', displayName: 'Zebec Network (ZBCN)', type: 'crypto' },
  'ZEBEC': { symbol: 'CRYPTO:ZBCNUSD', displayName: 'Zebec Network (ZBCN)', type: 'crypto' },
  'MYX': { symbol: 'CRYPTO:MYXUSD', displayName: 'MYX (MYX)', type: 'crypto' },
  'MYXUSDT': { symbol: 'MEXC:MYXUSDT', displayName: 'MYX (USDT)', type: 'crypto' },
  'DEXE': { symbol: 'DEXEUSD', displayName: 'DeXe (DEXE)', type: 'crypto' },
  // Mini chart fixes for requested assets
  'AIC': { symbol: 'MEXC:AICUSDT', displayName: 'AI Companions (AIC)', type: 'crypto' },
  'AICUSDT': { symbol: 'MEXC:AICUSDT', displayName: 'AI Companions (AIC)', type: 'crypto' },
  'APEPE': { symbol: 'MEXC:APEPEUSDT', displayName: 'Ape and Pepe (APEPE)', type: 'crypto' },
  'APEPEUSDT': { symbol: 'MEXC:APEPEUSDT', displayName: 'Ape and Pepe (APEPE)', type: 'crypto' },
  'APEPEUSD': { symbol: 'MEXC:APEPEUSDT', displayName: 'Ape and Pepe (APEPE)', type: 'crypto' },
  // Explicit mappings to prevent NASDAQ defaults
  'ADX': { symbol: 'MEXC:ADXUSDT', displayName: 'Ambire AdEx (ADX)', type: 'crypto' },
  'CORN': { symbol: 'MEXC:CORNUSDT', displayName: 'CORN (CORN)', type: 'crypto' },
  // DeFi assets
  'DEFI': { symbol: 'BYBIT:DEFIUSDT', displayName: 'DeFi (DEFI)', type: 'crypto' },
  'DE-FI': { symbol: 'BYBIT:DEFIUSDT', displayName: 'DeFi (DEFI)', type: 'crypto' },
};

// Index and Forex tickers
export const INDEX_FOREX_TICKERS: Record<string, TickerMapping> = {
  'SPX': { symbol: 'SPY', displayName: 'S&P 500 (SPY)', type: 'index' },
  'S&P 500': { symbol: 'SPY', displayName: 'S&P 500 (SPY)', type: 'index' },
  'DXY': { symbol: 'TVC:DXY', displayName: 'US Dollar Index (DXY)', type: 'forex' },
  'XAUUSD': { symbol: 'OANDA:XAUUSD', displayName: 'Gold (XAU/USD)', type: 'forex' },
  'GOLD': { symbol: 'OANDA:XAUUSD', displayName: 'Gold (XAU/USD)', type: 'forex' },
};

// Combine all mappings
export const ALL_TICKER_MAPPINGS: Record<string, TickerMapping> = {
  ...STOCK_TICKERS,
  ...CRYPTO_TICKERS,
  ...INDEX_FOREX_TICKERS,
};

/**
 * Get ticker mapping with proper validation
 * Returns undefined if ticker is not recognized
 */
export function getTickerMapping(ticker: string): TickerMapping | undefined {
  const upperTicker = ticker.toUpperCase().trim();
  return ALL_TICKER_MAPPINGS[upperTicker];
}

/**
 * Check if a ticker is a known stock
 */
export function isKnownStock(ticker: string): boolean {
  const upperTicker = ticker.toUpperCase().trim();
  return upperTicker in STOCK_TICKERS;
}

/**
 * Check if a ticker is a known crypto
 */
export function isKnownCrypto(ticker: string): boolean {
  const upperTicker = ticker.toUpperCase().trim();
  return upperTicker in CRYPTO_TICKERS;
}
