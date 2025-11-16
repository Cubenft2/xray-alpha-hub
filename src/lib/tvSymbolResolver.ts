/**
 * TradingView Symbol Resolution Utility
 * Generates prioritized list of exchange:pair candidates for TradingView charts
 * Priority: USD > USDT, Trusted exchanges (Coinbase/Kraken/Bitstamp) > Others
 */

// Exchange priority for USD pairs (trusted exchanges first)
const USD_EXCHANGES = ['COINBASE', 'KRAKEN', 'BITSTAMP'];

// Exchange priority for USDT pairs (high liquidity venues)
const USDT_EXCHANGES = ['BINANCE', 'OKX', 'BYBIT', 'KUCOIN', 'MEXC', 'GATEIO'];

/**
 * Generate a prioritized list of TradingView symbol candidates
 * @param baseSymbol - The cryptocurrency symbol (e.g., 'BTC', 'ETH')
 * @param mappedSymbol - Optional pre-mapped tradingview_symbol from database
 * @returns Array of exchange:pair candidates to try in order
 */
export function getTvCandidates(baseSymbol: string, mappedSymbol?: string): string[] {
  const candidates: string[] = [];
  let base = baseSymbol.toUpperCase().trim();

  // If no mapping provided, try normalizing the symbol
  // Strip trailing digits: GIGA2 → GIGA, PEPE3 → PEPE
  if (!mappedSymbol) {
    base = base.replace(/\d+$/, '');
  }

  // 1. If we have a valid mapping with exchange prefix, try it first
  if (mappedSymbol && mappedSymbol.includes(':')) {
    candidates.push(mappedSymbol);
  }

  // 2. Add USD pairs on trusted exchanges (Coinbase, Kraken, Bitstamp)
  for (const exchange of USD_EXCHANGES) {
    const candidate = `${exchange}:${base}USD`;
    if (!candidates.includes(candidate)) {
      candidates.push(candidate);
    }
  }

  // 3. Add USDT pairs on major venues (Binance, OKX, Bybit, etc.)
  for (const exchange of USDT_EXCHANGES) {
    const candidate = `${exchange}:${base}USDT`;
    if (!candidates.includes(candidate)) {
      candidates.push(candidate);
    }
  }

  // 4. Add a few more USD fallbacks on other exchanges
  const additionalUSDExchanges = ['BINANCE', 'OKX', 'BYBIT'];
  for (const exchange of additionalUSDExchanges) {
    const candidate = `${exchange}:${base}USD`;
    if (!candidates.includes(candidate)) {
      candidates.push(candidate);
    }
  }

  return candidates;
}

/**
 * Format a TradingView symbol for display
 * Extracts the exchange and pair from a full symbol
 */
export function formatTvSymbol(symbol: string): { exchange: string; pair: string } {
  const parts = symbol.split(':');
  if (parts.length === 2) {
    return { exchange: parts[0], pair: parts[1] };
  }
  return { exchange: '', pair: symbol };
}
