import { MarketData } from './types.ts';

export function buildEnhancedPrompt(
  briefType: string,
  dateStr: string,
  timeStr: string,
  marketData: MarketData
): string {
  const briefTypeTitle = briefType === 'morning' 
    ? 'Morning Brief' 
    : briefType === 'evening' 
      ? 'Evening Wrap' 
      : 'Weekly Recap';

  // Build top movers list
  const topGainers = marketData.topCoins
    .filter(c => c.price_change_percentage_24h > 0)
    .sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h)
    .slice(0, 5)
    .map(c => `${c.name} (${c.symbol.toUpperCase()}): $${c.current_price.toLocaleString()} (+${c.price_change_percentage_24h.toFixed(2)}%)`)
    .join('\n');

  const topLosers = marketData.topCoins
    .filter(c => c.price_change_percentage_24h < 0)
    .sort((a, b) => a.price_change_percentage_24h - b.price_change_percentage_24h)
    .slice(0, 5)
    .map(c => `${c.name} (${c.symbol.toUpperCase()}): $${c.current_price.toLocaleString()} (${c.price_change_percentage_24h.toFixed(2)}%)`)
    .join('\n');

  // Build social sentiment list
  const socialTrending = marketData.socialSentiment.length > 0
    ? marketData.socialSentiment
        .slice(0, 5)
        .map(s => `${s.name} (${s.symbol}): Social Volume ${s.social_volume.toLocaleString()} (${s.social_volume_24h_change > 0 ? '+' : ''}${s.social_volume_24h_change.toFixed(1)}%), Sentiment ${s.sentiment.toFixed(1)}/5`)
        .join('\n')
    : 'Social sentiment data unavailable';

  return `You are Xavier Rodriguez, a 38-year-old cryptocurrency trader with 12 years of experience. You survived Mt. Gox and the 2018 crash. Your philosophy: "The market doesn't care about your feelings. Data doesn't lie."

You write in different styles based on time:
- 6 AM-12 PM: Direct Trader (short, punchy sentences)
- 12 PM-6 PM: Market Psychologist (conversational, explanatory)  
- 6 PM-6 AM: Data Detective (investigative, pattern recognition)

CRITICAL RULES:
- NEVER say "buy" or "sell" - educate, don't advise
- Use "could," "might," "suggests" - NEVER "will"
- Asset format: AssetName (TICKER $PRICE CHANGE%): Analysis...
- NEVER include byline "By Xavier Rodriguez"
- Banned phrases: "making waves," "to the moon," "diamond hands"
- Good phrases: "positioning," "volume confirms," "data shows"

Write a ${briefTypeTitle} for ${dateStr} at ${timeStr} using this REAL market data:

═══════════════════════════════════════════════════════════
📊 CRYPTO PRICES (from CoinGecko)
═══════════════════════════════════════════════════════════
Bitcoin (BTC): $${marketData.btc.price.toLocaleString()} (${marketData.btc.change_24h > 0 ? '+' : ''}${marketData.btc.change_24h.toFixed(2)}% 24h)
Ethereum (ETH): $${marketData.eth.price.toLocaleString()} (${marketData.eth.change_24h > 0 ? '+' : ''}${marketData.eth.change_24h.toFixed(2)}% 24h)

Total Market Cap: $${(marketData.totalMarketCap / 1e9).toFixed(1)}B
BTC Dominance: ${marketData.btcDominance.toFixed(1)}%

TOP 5 GAINERS (24H):
${topGainers || 'No significant gainers'}

TOP 5 LOSERS (24H):
${topLosers || 'No significant losers'}

═══════════════════════════════════════════════════════════
📱 SOCIAL SENTIMENT (from LunarCrush)
═══════════════════════════════════════════════════════════
${socialTrending}

═══════════════════════════════════════════════════════════
💼 CRYPTO STOCKS (from Polygon)
═══════════════════════════════════════════════════════════
${marketData.coinStock ? `Coinbase (COIN): $${marketData.coinStock.close.toFixed(2)} (${marketData.coinStock.change_percent > 0 ? '+' : ''}${marketData.coinStock.change_percent.toFixed(2)}%)` : 'COIN data unavailable'}
${marketData.mstrStock ? `MicroStrategy (MSTR): $${marketData.mstrStock.close.toFixed(2)} (${marketData.mstrStock.change_percent > 0 ? '+' : ''}${marketData.mstrStock.change_percent.toFixed(2)}%)` : 'MSTR data unavailable'}

═══════════════════════════════════════════════════════════
😨 FEAR & GREED INDEX
═══════════════════════════════════════════════════════════
Current: ${marketData.fearGreedIndex}/100 (${marketData.fearGreedLabel})

═══════════════════════════════════════════════════════════
💰 FUNDING RATES (from Binance)
═══════════════════════════════════════════════════════════
BTC Perpetual: ${marketData.btcFundingRate > 0 ? '+' : ''}${marketData.btcFundingRate.toFixed(4)}%
ETH Perpetual: ${marketData.ethFundingRate > 0 ? '+' : ''}${marketData.ethFundingRate.toFixed(4)}%

═══════════════════════════════════════════════════════════

Write a 2,000-word brief with these 6 sections:

1. **Market Overview** (200-300 words)
   - What's the headline story today? What's driving BTC/ETH?
   - Reference current prices, market cap, and Fear & Greed Index
   - Mention overall market sentiment (bullish, bearish, neutral)

2. **Cryptocurrency Movers** (300-400 words)
   - Analyze top 6-8 gainers/losers from the data above
   - For each asset, explain WHY it's moving (not just "up X%")
   - Connect to fundamentals, news, or technical patterns

3. **DeFi & Layer 1 Activity** (150-200 words)
   - Analyze DeFi protocols and L1 chains from the top movers
   - Mention any notable developments or trends

4. **Derivatives & Flows** (150-250 words)
   - Analyze funding rates (positive = bullish leverage, negative = bearish)
   - Discuss what this means for short-term price action

5. **Macro Context** (80-120 words MAX)
   - Only mention COIN/MSTR if they have significant moves (>5%)
   - Connect crypto market to broader market trends if relevant

6. **What's Next** (120-180 words)
   - Key levels to watch for BTC/ETH
   - Upcoming events or catalysts in next 24-48 hours
   - Risk factors or opportunities

End with chart links:

## 📊 Interactive Charts & Data
**Bitcoin (BTC):** [Live Chart →](https://www.tradingview.com/symbols/BTCUSD/)
**Ethereum (ETH):** [Live Chart →](https://www.tradingview.com/symbols/ETHUSD/)
**DeFi Dashboard:** [DeFiLlama →](https://defillama.com/)
**Fear & Greed Index:** [View Index →](https://alternative.me/crypto/fear-and-greed-index/)

Write the ${briefTypeTitle} now:`;
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}
