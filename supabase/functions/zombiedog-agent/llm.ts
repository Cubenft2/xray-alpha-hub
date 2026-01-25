// LLM Caller: Lovable AI → OpenAI → Anthropic fallback chain
// UPGRADED: Rich data formatting with technicals, social, AI summaries

import { SessionContext } from "./context.ts";
import { ResolvedAsset } from "./resolver.ts";
import { ToolResults, MarketSummary } from "./orchestrator.ts";
import { RouteConfig, Intent } from "./router.ts";
import { ParsedIntent } from "./intent-parser.ts";
import { FetchedData, SECTOR_TOKENS, RichToken, RichStock } from "./data-fetcher.ts";

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMResult {
  stream: ReadableStream;
  provider: string;
  model: string;
}

// Provider config
const PROVIDERS = [
  {
    name: 'lovable',
    url: 'https://ai.gateway.lovable.dev/v1/chat/completions',
    key: 'LOVABLE_API_KEY',
    model: 'google/gemini-2.5-flash',
    modelComplex: 'google/gemini-2.5-pro',
  },
  {
    name: 'openai',
    url: 'https://api.openai.com/v1/chat/completions',
    key: 'OPENAI_API_KEY',
    model: 'gpt-4o-mini',
    modelComplex: 'gpt-4o-mini',
  },
  {
    name: 'anthropic',
    url: 'https://api.anthropic.com/v1/messages',
    key: 'ANTHROPIC_API_KEY',
    model: 'claude-3-5-haiku-20241022',
    modelComplex: 'claude-3-5-haiku-20241022',
  },
];

// Helper functions for formatting
function formatPrice(price: number | null): string {
  if (price === null || price === undefined) return '?';
  if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (price >= 1) return price.toFixed(2);
  if (price >= 0.01) return price.toFixed(4);
  return price.toFixed(8);
}

function formatLargeNumber(num: number | null): string {
  if (num === null || num === undefined) return '?';
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toFixed(0);
}

function formatRichTokenCard(token: any): string {
  const changeEmoji = (token.change_24h_pct || 0) >= 0 ? '🟢' : '🔴';
  const changeSign = (token.change_24h_pct || 0) >= 0 ? '+' : '';
  
  let card = `\n**${token.name} (${token.canonical_symbol})** #${token.market_cap_rank || '?'}\n`;
  card += `$${formatPrice(token.price_usd)} (${changeSign}${(token.change_24h_pct || 0).toFixed(2)}%) ${changeEmoji}\n`;
  card += `MCap: $${formatLargeNumber(token.market_cap)} │ Vol: $${formatLargeNumber(token.volume_24h_usd)}\n`;
  
  // Technicals (if available)
  const technicals: string[] = [];
  if (token.rsi_14) {
    const rsiStatus = token.rsi_14 > 70 ? 'overbought' : token.rsi_14 < 30 ? 'oversold' : 'neutral';
    technicals.push(`RSI ${Math.round(token.rsi_14)} (${rsiStatus})`);
  }
  if (token.macd_trend) {
    technicals.push(`MACD ${token.macd_trend}`);
  }
  if (token.price_vs_sma_50) {
    technicals.push(`${token.price_vs_sma_50} 50 SMA`);
  }
  if (technicals.length > 0) {
    card += `📈 Technical: ${technicals.join(' • ')}\n`;
  }
  
  // Social (if available)
  const social: string[] = [];
  if (token.galaxy_score) social.push(`Galaxy ${token.galaxy_score}`);
  if (token.sentiment) {
    const sentEmoji = token.sentiment > 60 ? '🟢' : token.sentiment < 40 ? '🔴' : '🟡';
    social.push(`Sentiment ${token.sentiment}% ${sentEmoji}`);
  }
  if (token.social_dominance) social.push(`Dominance ${token.social_dominance.toFixed(1)}%`);
  if (social.length > 0) {
    card += `🔥 Social: ${social.join(' │ ')}\n`;
  }
  
  // AI Summary (the gold - what's actually happening)
  const aiSummary = token.ai_summary_short || token.ai_summary;
  if (aiSummary) {
    // Truncate to first sentence or 120 chars
    const shortSummary = aiSummary.split('.')[0].slice(0, 120);
    card += `💬 "${shortSummary}"\n`;
  }
  
  return card;
}

// FIX #4: Strict tool data contract with timestamps and recency
export function buildSystemPrompt(
  context: SessionContext,
  assets: ResolvedAsset[],
  tools: ToolResults,
  config: RouteConfig
): string {
  const now = new Date().toISOString();
  
  const parts: string[] = [
    `You are ZombieDog 🧟🐕, a battle-tested crypto & stocks market analyst with a no-BS attitude.`,
    `You speak casually but provide accurate, data-driven insights.`,
    `Current time: ${now}`,
    ``,
    `## Your Rules:`,
    `- NEVER ask clarifying questions. Use the data provided.`,
    `- NEVER say "I don't have aggregated data" or "I can't analyze a list I don't have" — you DO have the data.`,
    `- If specific data is marked "MISSING", acknowledge it but still synthesize what you DO have.`,
    `- For multi-asset/group questions: compute aggregations yourself from the data provided (e.g., "68% green").`,
    `- For prices: show symbol, price, 24h %, and data age (e.g., "updated 42s ago").`,
    `- For safety: show risk level, flags, and verdict.`,
    `- For content creation: output ONLY the requested content.`,
    `- Keep responses concise but informative.`,
    `- Respond in the SAME LANGUAGE the user writes in.`,
    `- When data shows "_stale" source, mention it may be slightly delayed.`,
    `- CRITICAL: ONLY use prices from the Tool Data JSON provided. NEVER guess or invent numbers.`,
    `- If price is missing for an asset, say "price data unavailable" — do NOT fabricate prices.`,
    ``,
    `## AI Summary Handling (IMPORTANT):`,
    `- NEVER mention "AI summary not available", "no AI narrative", or "AI data missing" to users.`,
    `- If ai_summary is null or missing for a token, simply don't reference it — use other available data.`,
    `- When ai_summary is missing, synthesize your own brief narrative from:`,
    `  • Price momentum (24h/7d change direction and magnitude)`,
    `  • Technical position (RSI overbought/oversold, price vs SMAs, MACD trend)`,
    `  • Social sentiment (Galaxy Score, sentiment %, social volume changes)`,
    `  • Market position (rank, market cap, volume anomalies)`,
    `- Your analysis should ALWAYS feel complete, regardless of which data fields are populated.`,
    `- Skip missing fields silently — don't apologize for missing data or reveal data limitations.`,
  ];
  
  // Add data recency summary
  if (tools.cacheStats?.ages && Object.keys(tools.cacheStats.ages).length > 0) {
    parts.push('');
    parts.push('## Data Recency:');
    for (const [key, ageSec] of Object.entries(tools.cacheStats.ages)) {
      const ageLabel = ageSec < 60 ? `${ageSec}s` : `${Math.round(ageSec / 60)}m`;
      parts.push(`- ${key}: updated ${ageLabel} ago`);
    }
  }
  
  // Add context about resolved assets
  if (assets.length > 0) {
    parts.push('');
    parts.push('## Assets in this query:');
    for (const asset of assets) {
      let line = `- ${asset.symbol} (${asset.type})`;
      if (asset.assumptionNote) line += ` — ${asset.assumptionNote}`;
      parts.push(line);
    }
  }
  
  // Add conversation context - BUT NOT for market_overview queries
  if (context.recentAssets.length > 0 && config.intent !== 'market_overview') {
    parts.push('');
    parts.push(`## Recent conversation context:`);
    parts.push(`Previously discussed: ${context.recentAssets.join(', ')}`);
  }
  
  // For market_overview: explicit instruction to use ONLY the fresh data
  if (config.intent === 'market_overview') {
    parts.push('');
    parts.push(`## MARKET OVERVIEW INSTRUCTIONS:`);
    parts.push(`- IGNORE any previous conversation context for this query.`);
    parts.push(`- Use ONLY the top 25 data from crypto_snapshot provided in Tool Data below.`);
    parts.push(`- Synthesize: Market Tone (bullish/bearish/neutral), Breadth (X% green), Leaders, Laggards.`);
    parts.push(`- Include Galaxy Score and Sentiment for top coins if available.`);
  }
  
  // For market_preset: CANONICAL PRESET EXECUTION - no guessing allowed
  if (config.intent === 'market_preset' && config.preset) {
    parts.push('');
    parts.push(`## MARKET PRESET EXECUTION (CANONICAL - NO GUESSING):`);
    parts.push(`- You executed the preset: "${config.preset.name}" (ID: ${config.preset.id})`);
    parts.push(`- Description: ${config.preset.description}`);
    parts.push(`- This data is the SINGLE SOURCE OF TRUTH for this query.`);
    parts.push(`- Present the data in a clear, ranked format.`);
    parts.push(`- Include: rank, symbol/name, price, 24h change %, and relevant metrics.`);
    parts.push(`- Add a brief summary at the top (e.g., "Here are the top 25 gainers from the last 24 hours...")`);
    parts.push(`- If zero rows returned, say: "I don't have verified data for that market view right now."`);
    parts.push(`- NEVER invent or hallucinate additional tokens not in the data.`);
  }
  
  // FIX #4: Tool Data Contract — explicit timestamps and missing data handling
  parts.push('');
  parts.push('## Tool Data (JSON format for accuracy):');
  parts.push('```json');
  
  const toolData: Record<string, any> = {};
  
  // Prices
  if (config.fetchPrices) {
    if (tools.prices && tools.prices.length > 0) {
      toolData.prices = {
        as_of: tools.timestamps.prices || now,
        age_seconds: tools.cacheStats?.ages?.prices || null,
        data: tools.prices.map(p => ({
          symbol: p.symbol,
          price: p.price,
          change_24h_pct: p.change24h,
          market_cap: p.marketCap || null,
          source: p.source,
          is_stale: p.source.includes('stale'),
        })),
      };
    } else {
      toolData.prices = { status: 'MISSING', reason: 'No price data found' };
    }
  }
  
  // Social
  if (config.fetchSocial) {
    if (tools.social && tools.social.length > 0) {
      toolData.social = {
        as_of: tools.timestamps.social || now,
        age_seconds: tools.cacheStats?.ages?.social || null,
        source: 'LunarCrush',
        data: tools.social.map(s => ({
          symbol: s.symbol,
          galaxy_score: s.galaxyScore || null,
          alt_rank: s.altRank || null,
          sentiment_pct: s.sentiment || null,
          social_volume: s.socialVolume || null,
        })),
      };
    } else {
      toolData.social = { status: 'MISSING', reason: 'No social data found' };
    }
  }
  
  // Derivatives
  if (config.fetchDerivs) {
    if (tools.derivs && tools.derivs.length > 0) {
      toolData.derivatives = {
        as_of: tools.timestamps.derivs || now,
        age_seconds: tools.cacheStats?.ages?.derivs || null,
        source: 'CoinGlass',
        data: tools.derivs.map(d => ({
          symbol: d.symbol,
          funding_rate_pct: (d.fundingRate * 100).toFixed(4),
          liquidations_24h: d.liquidations24h,
        })),
      };
    } else {
      toolData.derivatives = { status: 'MISSING', reason: 'No derivatives data found' };
    }
  }
  
  // Security
  if (config.fetchSecurity) {
    if (tools.security) {
      toolData.security = {
        as_of: tools.timestamps.security || now,
        sources: ['GoPlus', 'DexScreener'],
        risk_level: tools.security.riskLevel,
        chain_detected: tools.security.chain || 'unknown',
        flags: tools.security.flags,
        is_honeypot: tools.security.isHoneypot || false,
        dex_liquidity_usd: tools.security.liquidity?.dex || null,
        contract_verified: tools.security.contractInfo?.verified || null,
        is_mintable: tools.security.contractInfo?.mintable || null,
      };
    } else {
      toolData.security = { status: 'MISSING', reason: 'Security check failed or timed out' };
    }
  }
  
  // News
  if (config.fetchNews) {
    if (tools.news && tools.news.length > 0) {
      toolData.news = {
        as_of: tools.timestamps.news || now,
        age_seconds: tools.cacheStats?.ages?.news || null,
        source: 'Tavily',
        articles: tools.news.slice(0, 3).map(n => ({
          title: n.title,
          source: n.source,
          date: n.date,
        })),
      };
    } else {
      toolData.news = { status: 'MISSING', reason: 'No news found or search skipped' };
    }
  }
  
  // Technical indicators
  if (config.fetchCharts) {
    if (tools.charts && Object.keys(tools.charts).length > 0) {
      toolData.technicals = {
        as_of: tools.timestamps.charts || now,
        age_seconds: tools.cacheStats?.ages?.charts || null,
        source: 'Polygon',
        rsi: tools.charts.rsi || null,
        sma_20: tools.charts.sma20 || null,
        sma_50: tools.charts.sma50 || null,
        macd: tools.charts.macd || null,
      };
    } else {
      toolData.technicals = { status: 'MISSING', reason: 'No technical data found' };
    }
  }
  
  // Asset details (fundamentals)
  if (config.fetchDetails) {
    if (tools.details) {
      toolData.details = {
        as_of: tools.details.as_of || tools.timestamps.details || now,
        age_seconds: tools.details.age_seconds ?? null,
        type: tools.details.type,
        name: tools.details.name,
        description: tools.details.description?.slice(0, 800) || null,
        categories: tools.details.categories || [],
        market_cap: tools.details.market?.market_cap ?? null,
        supply: tools.details.supply ?? null,
        social: tools.details.social ?? null,
        stale: !!tools.details.stale,
        swr: !!tools.details.swr,
        notes: tools.details.notes ?? null,
      };
    } else {
      toolData.details = { status: 'MISSING', reason: 'No asset details found' };
    }
  }
  
  parts.push(JSON.stringify(toolData, null, 2));
  parts.push('```');
  
  // Intent-specific instructions
  if (config.intent === 'content') {
    parts.push('');
    parts.push('## Content Creation Mode:');
    parts.push('Output ONLY the requested post/tweet/content. No extra commentary.');
  }
  
  if (config.intent === 'safety') {
    parts.push('');
    parts.push('## Safety Analysis Format:');
    parts.push('1. Token/Address identified');
    parts.push('2. Chain detected');
    parts.push('3. Risk Level (Low/Medium/High)');
    parts.push('4. Flags found');
    parts.push('5. Liquidity info');
    parts.push('6. Verdict (2 sentences max)');
  }
  
  // NEW: General chat mode (greetings, capabilities)
  if (config.intent === 'general_chat') {
    parts.push('');
    parts.push('## GENERAL CHAT MODE:');
    parts.push('You are responding to a greeting or question about your capabilities.');
    parts.push('');
    parts.push('**If greeting (hi, hello, hey, gm, thanks):**');
    parts.push('- Respond briefly and friendly, staying in character as ZombieDog');
    parts.push('- Mention you can help with crypto/stock prices, market analysis, safety checks, etc.');
    parts.push('- Keep it to 2-3 sentences max');
    parts.push('');
    parts.push('**If asking what you can do / help:**');
    parts.push('- List your main capabilities:');
    parts.push('  • Price checks (any crypto or stock)');
    parts.push('  • Market overviews (top gainers, losers, trending)');
    parts.push('  • Token analysis (technicals, social sentiment, galaxy score)');
    parts.push('  • Safety scans (check if a token/address is safe)');
    parts.push('  • News and sentiment updates');
    parts.push('  • Comparisons (BTC vs ETH, etc.)');
    parts.push('- Keep it concise, friendly, in character');
  }
  
  // NEW: Compare mode (BTC vs ETH)
  if (config.intent === 'compare') {
    parts.push('');
    parts.push('## COMPARISON MODE:');
    parts.push('You are comparing multiple assets side-by-side.');
    parts.push('');
    parts.push('**Format your response as:**');
    parts.push('1. Quick intro acknowledging the comparison');
    parts.push('2. Side-by-side metrics table or bullets:');
    parts.push('   - Price + 24h change');
    parts.push('   - Market cap');
    parts.push('   - Volume (if significant difference)');
    parts.push('   - Galaxy Score / Sentiment (if available)');
    parts.push('   - Technical signals (if available)');
    parts.push('3. Your take: Which looks stronger right now and why');
    parts.push('4. Any notable divergences in social sentiment or technicals');
    parts.push('');
    parts.push('Keep it punchy - this is a quick comparison, not a deep dive.');
  }
  
  // NEW: Market Overview response template
  if (config.intent === 'market_overview' && tools.marketSummary) {
    const ms = tools.marketSummary;
    parts.push('');
    parts.push('## Market Overview Response Format:');
    parts.push('You MUST synthesize the data into a high-level summary. Use this structure:');
    parts.push('');
    parts.push('### Top [N] Market Snapshot');
    parts.push('');
    parts.push(`**Pre-computed summary (use this!):**`);
    parts.push(`- Total assets: ${ms.total}`);
    parts.push(`- Green: ${ms.greenCount} | Red: ${ms.redCount}`);
    parts.push(`- Breadth: ${ms.breadthPct}%`);
    parts.push(`- Leaders: ${ms.leaders.map(l => `${l.symbol} ${l.change >= 0 ? '+' : ''}${l.change.toFixed(1)}%`).join(', ')}`);
    parts.push(`- Laggards: ${ms.laggards.map(l => `${l.symbol} ${l.change >= 0 ? '+' : ''}${l.change.toFixed(1)}%`).join(', ')}`);
    if (ms.avgGalaxyScore) parts.push(`- Avg Galaxy Score: ${ms.avgGalaxyScore}/100`);
    parts.push('');
    parts.push('**Your response should include:**');
    parts.push('1. **Market Tone**: (Bullish/Neutral/Bearish) based on breadth %');
    parts.push('2. **Breadth**: "X% of top N green" from the pre-computed breadthPct');
    parts.push('3. **Leaders**: Top 3 performers with % gains (from pre-computed leaders)');
    parts.push('4. **Laggards**: Bottom 3 performers with % losses (from pre-computed laggards)');
    parts.push('5. **Social Pulse**: Mention Galaxy Score / sentiment if notable');
    parts.push('6. **One-liner summary**: Quick market vibe, no tables');
    parts.push('');
    parts.push('End with: "Want a deeper dive on any specific coin?"');
    parts.push('');
    parts.push('DO NOT:');
    parts.push('- Say "I don\'t have aggregated data" - you DO, it\'s pre-computed above');
    parts.push('- Output raw data tables');
    parts.push('- Refuse to synthesize');
  }
  
  return parts.join('\n');
}

// UPGRADED: Intent-based prompt builder with RICH data formatting
export function buildIntentBasedPrompt(
  intent: ParsedIntent,
  data: FetchedData,
  context: SessionContext
): string {
  const now = new Date().toISOString();
  
  const base = [
    `You are ZombieDog 🧟🐕, a battle-tested crypto & stocks market analyst with a no-BS attitude.`,
    `You speak casually but provide accurate, data-driven insights.`,
    `Current time: ${now}`,
    ``,
    `## Your Rules:`,
    `- Use specific numbers from the data provided (prices, % changes, scores)`,
    `- Keep responses concise (2-4 paragraphs max)`,
    `- End EVERY response with: "Not financial advice. I'm a zombie dog. 🐕"`,
    `- Use $ for prices, % for changes`,
    `- Don't be overly formal`,
    `- Respond in the SAME LANGUAGE the user writes in`,
    `- CRITICAL: ONLY use data from the JSON provided. NEVER guess or invent numbers.`,
    `- If price is missing, say "price data unavailable" — do NOT fabricate prices.`,
    ``,
    `## AI Summary Handling (CRITICAL):`,
    `- NEVER say "AI summary not available", "no AI narrative", or anything revealing missing AI data.`,
    `- If ai_summary is null/missing, skip it silently and synthesize your own brief narrative from:`,
    `  • Price action: Is it pumping/dumping? By how much?`,
    `  • Technicals: RSI overbought/oversold? Above/below key SMAs? MACD bullish/bearish?`,
    `  • Social: Galaxy Score strong/weak? Sentiment bullish/bearish? Volume spiking?`,
    `- Your analysis should feel complete whether or not an AI summary exists.`,
    `- Never apologize for missing data or reveal our data coverage limitations.`,
    ``,
  ];
  
  // Add context about what user asked
  base.push(`## User's Question Interpreted:`);
  base.push(`- Intent: ${intent.intent}`);
  if (intent.sector) base.push(`- Sector: ${intent.sector.toUpperCase()}`);
  if (intent.tickers.length > 0) base.push(`- Specific tokens: ${intent.tickers.join(', ')}`);
  if (intent.action) base.push(`- Looking for: ${intent.action}`);
  base.push(`- Summary: ${intent.summary}`);
  base.push(``);
  
  // Add conversation context if not general chat
  if (context.recentAssets.length > 0 && intent.intent !== 'general_chat') {
    base.push(`## Recent conversation context:`);
    base.push(`Previously discussed: ${context.recentAssets.join(', ')}`);
    base.push(``);
  }
  
  // Add intent-specific instructions with RICH data format requirements
  switch (intent.intent) {
    case 'market_overview':
      base.push(`## MARKET OVERVIEW TASK:`);
      base.push(`Give a comprehensive market snapshot using the FULL data provided.`);
      base.push(``);
      base.push(`**Response Structure:**`);
      base.push(`1. **Market Pulse Header** - Date, overall tone (bullish/neutral/bearish)`);
      base.push(`2. **Top 3 Tokens with Rich Cards** - For each major token show:`);
      base.push(`   - Price + 24h % change`);
      base.push(`   - Technical signals: RSI, MACD trend, SMA position`);
      base.push(`   - Social: Galaxy Score, Sentiment %, Social Dominance`);
      base.push(`   - AI Summary quote (the WHY behind the move)`);
      base.push(`3. **Movers Section** - Top gainers and losers with Galaxy Score and AI summary`);
      base.push(`4. **ZombieDog Take** - Your personal market read (2-3 sentences)`);
      base.push(``);
      if (data.marketSummary) {
        base.push(`**Pre-computed summary:**`);
        base.push(`- Total: ${data.marketSummary.total} | Green: ${data.marketSummary.greenCount} | Red: ${data.marketSummary.redCount}`);
        base.push(`- Breadth: ${data.marketSummary.breadthPct}%`);
        base.push(`- Leaders: ${data.marketSummary.leaders.map(l => `${l.symbol} ${l.change >= 0 ? '+' : ''}${l.change.toFixed(1)}% (Galaxy: ${l.galaxy || '?'})`).join(', ')}`);
        base.push(`- Laggards: ${data.marketSummary.laggards.map(l => `${l.symbol} ${l.change >= 0 ? '+' : ''}${l.change.toFixed(1)}%`).join(', ')}`);
        if (data.marketSummary.avgGalaxyScore) base.push(`- Avg Galaxy Score: ${data.marketSummary.avgGalaxyScore}/100`);
        if (data.marketSummary.avgSentiment) base.push(`- Avg Sentiment: ${data.marketSummary.avgSentiment}%`);
        if (data.marketSummary.avgRsi) base.push(`- Avg RSI: ${data.marketSummary.avgRsi}`);
      }
      break;
      
    case 'sector_analysis':
      base.push(`## SECTOR ANALYSIS TASK:`);
      base.push(`Analyze the ${intent.sector?.toUpperCase() || 'crypto'} sector with RICH data.`);
      base.push(``);
      base.push(`**Response Structure:**`);
      base.push(`1. **Sector Header** - Name, breadth (X/Y green), overall sector tone`);
      base.push(`2. **Top 5 Tokens** - For each show: Price, 24h%, Technicals, Social metrics, AI summary`);
      base.push(`3. **Sector Insights** - Any patterns? Divergences between price and social?`);
      if (intent.action === 'gainers') {
        base.push(`Focus on the TOP GAINERS in this sector.`);
      } else if (intent.action === 'losers') {
        base.push(`Focus on the BIGGEST LOSERS in this sector.`);
      }
      if (data.marketSummary) {
        base.push(``);
        base.push(`**Sector summary:**`);
        base.push(`- Total tokens: ${data.marketSummary.total}`);
        base.push(`- Green: ${data.marketSummary.greenCount} | Red: ${data.marketSummary.redCount}`);
        base.push(`- Sector breadth: ${data.marketSummary.breadthPct}%`);
        base.push(`- Leaders: ${data.marketSummary.leaders.map(l => `${l.symbol} ${l.change >= 0 ? '+' : ''}${l.change.toFixed(1)}%`).join(', ')}`);
        base.push(`- Laggards: ${data.marketSummary.laggards.map(l => `${l.symbol} ${l.change >= 0 ? '+' : ''}${l.change.toFixed(1)}%`).join(', ')}`);
        if (data.marketSummary.avgGalaxyScore) base.push(`- Avg Galaxy Score: ${data.marketSummary.avgGalaxyScore}/100`);
      }
      break;
      
    case 'token_lookup':
      base.push(`## TOKEN LOOKUP TASK:`);
      
      // Check for deep analysis mode
      if ((intent as any).depth === 'deep') {
        base.push(`🔬 **DEEP ANALYSIS MODE ACTIVATED** - Provide comprehensive report with ALL data sources.`);
        base.push(``);
        base.push(`**COMPREHENSIVE REPORT STRUCTURE:**`);
        base.push(``);
        base.push(`### 📊 PRICE & MARKET POSITION`);
        base.push(`- Current price with 24h/7d % change`);
        base.push(`- Market cap, rank, fully diluted valuation`);
        base.push(`- Volume 24h, VWAP, bid/ask spread if available`);
        base.push(`- ATH/ATL with dates and distance %`);
        base.push(``);
        base.push(`### 📈 TECHNICAL ANALYSIS`);
        base.push(`- RSI with interpretation (overbought >70, oversold <30)`);
        base.push(`- MACD: line value, signal value, histogram, trend direction`);
        base.push(`- SMAs: 20/50/200 with price position (above/below)`);
        base.push(`- EMAs: 12/26 if available`);
        base.push(`- Overall technical signal (bullish/bearish/neutral)`);
        base.push(``);
        base.push(`### 🔥 SOCIAL INTELLIGENCE`);
        base.push(`- Galaxy Score (0-100) with interpretation`);
        base.push(`- AltRank position`);
        base.push(`- Sentiment % (bullish vs bearish)`);
        base.push(`- Social volume, dominance %, engagements`);
        base.push(`- Top creators/influencers if available`);
        base.push(``);
        base.push(`### 💡 PREMIUM AI NARRATIVE (if available)`);
        base.push(`- Headline insight`);
        base.push(`- Key insights array`);
        base.push(`- Price analysis`);
        base.push(`- Supportive themes with percentages`);
        base.push(`- Critical themes/risks with percentages`);
        base.push(``);
        base.push(`### 📊 DERIVATIVES DATA (if available for major tokens)`);
        base.push(`- Funding rate (positive = longs paying shorts)`);
        base.push(`- Open interest`);
        base.push(`- 24h liquidations (long vs short breakdown)`);
        base.push(``);
        base.push(`### 💰 SUPPLY & TOKENOMICS`);
        base.push(`- Circulating supply`);
        base.push(`- Total supply, max supply if capped`);
        base.push(`- Fully diluted valuation`);
        base.push(``);
        base.push(`### 🎯 VERDICT`);
        base.push(`- Overall assessment (1-2 sentences)`);
        base.push(`- Key opportunities and risks`);
        base.push(`- What to watch for next`);
        base.push(``);
        base.push(`Use all available data. If any section has no data, skip it silently.`);
        base.push(`Format with emojis for easy scanning.`);
      } else {
        base.push(`Give a COMPREHENSIVE analysis of these specific tokens.`);
        base.push(``);
        base.push(`**For each token include:**`);
        base.push(`1. **Header**: Name (Symbol) #Rank`);
        base.push(`2. **Price**: Current price, 24h change %, 7d change if available`);
        base.push(`3. **Market**: Market cap, Volume 24h, ATH info if relevant`);
        base.push(`4. **Technicals**: RSI (overbought/oversold/neutral), MACD trend, SMA position`);
        base.push(`5. **Social**: Galaxy Score, Sentiment %, Social Dominance, Social Volume`);
        base.push(`6. **Narrative**: If ai_summary exists, use it. If not, synthesize your own from price+technicals+social.`);
        base.push(`7. **Your Take**: 1-2 sentence interpretation`);
        base.push(``);
        base.push(`NOTE: Never mention if AI summary is missing - just provide your synthesized analysis.`);
      }
      break;
      
    case 'comparison':
      base.push(`## COMPARISON TASK:`);
      base.push(`Compare these tokens head-to-head: ${intent.tickers.join(' vs ')}`);
      base.push(``);
      base.push(`**Side-by-Side Format:**`);
      base.push(`| Metric | Token1 | Token2 |`);
      base.push(`- Price + 24h change`);
      base.push(`- Market Cap + Rank`);
      base.push(`- Volume 24h`);
      base.push(`- RSI + Technical Signal`);
      base.push(`- Galaxy Score + Sentiment`);
      base.push(`- AI Summary snippet`);
      base.push(``);
      base.push(`**Then give your verdict:**`);
      base.push(`- Which looks stronger RIGHT NOW and why`);
      base.push(`- Any interesting divergences (e.g., price down but sentiment up)`);
      break;
      
    case 'trending':
      base.push(`## TRENDING TASK:`);
      if (intent.action === 'gainers') {
        base.push(`Show the TOP GAINERS with full context.`);
        base.push(`For each: Price, 24h%, Galaxy Score, AI Summary (the WHY)`);
      } else if (intent.action === 'losers') {
        base.push(`Show the BIGGEST LOSERS. What's getting rekt and WHY?`);
        base.push(`Use the AI summaries to explain the narratives.`);
      } else if (intent.action === 'volume') {
        base.push(`Show the highest VOLUME tokens. Where is the action happening?`);
        base.push(`Include Galaxy Score to see if it's organic interest.`);
      } else {
        base.push(`Show what's TRENDING socially.`);
        base.push(`Use Galaxy Score, sentiment, and AI summaries.`);
      }
      break;
      
    case 'news':
      base.push(`## NEWS/SENTIMENT TASK:`);
      base.push(`Summarize the latest news and sentiment for ${intent.tickers.length > 0 ? intent.tickers.join(', ') : 'the crypto market'}.`);
      base.push(``);
      base.push(`**Response Structure:**`);
      base.push(`1. **Headlines Overview** - Summarize the top 3-5 news stories`);
      base.push(`2. **Sentiment Pulse** - Overall market/token sentiment based on news tone`);
      base.push(`3. **Key Themes** - What narratives are dominating?`);
      base.push(`4. **Your Take** - 1-2 sentences on what this means for the asset/market`);
      base.push(``);
      base.push(`Format each news item as:`);
      base.push(`📰 **"Headline"** - Source, X hours ago`);
      base.push(`Brief summary or key takeaway`);
      base.push(``);
      // Add news data if available
      if (data.news && data.news.length > 0) {
        base.push(`## News Data (${data.news.length} articles):`);
        base.push('```json');
        base.push(JSON.stringify(data.news.slice(0, 10).map((n: any) => ({
          title: n.title,
          summary: n.summary?.slice(0, 200),
          source: n.source,
          published: n.published_at,
          tickers: n.tickers,
          sentiment: n.sentiment,
        })), null, 2));
        base.push('```');
      } else {
        base.push(`Note: No fresh news articles found. Synthesize based on token social data (Galaxy Score, sentiment, top_posts if available).`);
      }
      break;
      
    case 'general_chat':
      base.push(`## GENERAL CHAT MODE:`);
      base.push(`Respond casually and friendly, staying in character as ZombieDog.`);
      base.push(`If greeting, say hi and mention you can help with crypto/stock/forex prices, market analysis, safety checks, etc.`);
      base.push(`If asking what you can do, list: price checks, market overviews, token analysis, safety scans, news/sentiment, comparisons, forex/gold/silver prices.`);
      base.push(`Keep it to 2-3 sentences. Skip the "Not financial advice" footer for greetings.`);
      break;
      
    case 'stock_lookup':
      base.push(`## STOCK LOOKUP TASK:`);
      base.push(`Give a COMPREHENSIVE analysis of these stocks.`);
      base.push(``);
      base.push(`**For each stock include:**`);
      base.push(`1. **Header**: Company Name (SYMBOL) - Exchange`);
      base.push(`2. **Price**: Current price, daily change %, 52-week range`);
      base.push(`3. **Fundamentals**: P/E ratio, EPS, Dividend Yield, Market Cap`);
      base.push(`4. **Technicals**: RSI (overbought/oversold/neutral), MACD, SMA positioning`);
      base.push(`5. **Company**: Sector, Industry, employees`);
      base.push(`6. **Your Take**: 1-2 sentence analysis`);
      break;
      
    case 'stock_sector':
      base.push(`## STOCK SECTOR ANALYSIS TASK:`);
      base.push(`Analyze the ${intent.stockSector?.toUpperCase() || 'sector'} sector.`);
      base.push(``);
      base.push(`**Response Structure:**`);
      base.push(`1. **Sector Header** - Name, overall tone (bullish/neutral/bearish)`);
      base.push(`2. **Top 5 Stocks** - For each: Price, daily %, Technicals, Fundamentals`);
      base.push(`3. **Sector Insights** - Any patterns or notable movers?`);
      if (intent.action === 'gainers') {
        base.push(`Focus on the TOP GAINERS in this sector.`);
      } else if (intent.action === 'losers') {
        base.push(`Focus on the BIGGEST LOSERS in this sector.`);
      }
      break;
  }
  
  // Add forex/metals handling if asset type is forex
  if (intent.assetType === 'forex') {
    base.push(``);
    base.push(`## FOREX/PRECIOUS METALS HANDLING:`);
    base.push(`- For precious metals (XAUUSD, XAGUSD, XPTUSD, XPDUSD), show spot price, 24h change, and technical signals`);
    base.push(`- For forex pairs (EURUSD, GBPUSD, etc.), show the exchange rate and 24h change`);
    base.push(`- This is OANDA spot price data (real-time forex market)`);
    base.push(`- Include: Rate, 24h change %, High/Low, RSI if available, SMA position`);
    base.push(`- For metals, mention they're quoted in USD per troy ounce`);
    base.push(`- For currency pairs, explain the rate (e.g., "1 EUR = X USD")`);
    base.push(`- Keep it concise: price + change + one technical insight`);
    base.push(`- **Note: Forex markets are closed on weekends. Friday close data is normal on Sat/Sun.**`);
  }
  
  // Add the RICH token data with all available fields including premium data
  if (data.tokens.length > 0) {
    const isDeepAnalysis = (intent as any).depth === 'deep';
    base.push(``);
    base.push(`## Token Data (RICH - use ALL of this):`);
    base.push('```json');
    base.push(JSON.stringify(data.tokens.slice(0, 15).map((t: any) => {
      const tokenData: any = {
        symbol: t.canonical_symbol,
        name: t.name,
        rank: t.market_cap_rank,
        description: isDeepAnalysis ? t.description?.slice?.(0, 500) : undefined,
        // Price data
        price_usd: t.price_usd,
        change_24h_pct: t.change_24h_pct,
        change_7d_pct: t.change_7d_pct,
        high_24h: t.high_24h,
        low_24h: t.low_24h,
        volume_24h_usd: t.volume_24h_usd,
        vwap_24h: t.vwap_24h,
        market_cap: t.market_cap,
        // Technicals (Polygon - include ALL numeric values)
        rsi_14: t.rsi_14,
        rsi_signal: t.rsi_signal,
        macd_line: t.macd_line,
        macd_signal: t.macd_signal,
        macd_histogram: t.macd_histogram,
        macd_trend: t.macd_trend,
        sma_20: t.sma_20,
        sma_50: t.sma_50,
        sma_200: t.sma_200,
        ema_12: t.ema_12,
        ema_26: t.ema_26,
        price_vs_sma_50: t.price_vs_sma_50,
        price_vs_sma_200: t.price_vs_sma_200,
        technical_signal: t.technical_signal,
        // Social (LunarCrush)
        galaxy_score: t.galaxy_score,
        alt_rank: t.alt_rank,
        sentiment: t.sentiment,
        sentiment_label: t.sentiment_label,
        social_volume_24h: t.social_volume_24h,
        social_dominance: t.social_dominance,
        interactions_24h: t.interactions_24h,
        // AI Summary (template-based for all tokens)
        ai_summary: isDeepAnalysis ? t.ai_summary : t.ai_summary?.slice?.(0, 300) || t.ai_summary_short,
        key_themes: t.key_themes,
        // ATH/ATL data
        ath_price: t.ath_price,
        ath_date: t.ath_date,
        ath_change_pct: t.ath_change_pct,
        atl_price: t.atl_price,
        atl_date: t.atl_date,
        // Supply data
        circulating_supply: t.circulating_supply,
        total_supply: t.total_supply,
        max_supply: t.max_supply,
        fully_diluted_valuation: t.fully_diluted_valuation,
      };
      
      // Add premium LunarCrush AI data if available (top 25 tokens)
      if (t.premium_headline || t.premium_insights) {
        tokenData.premium_ai = {
          headline: t.premium_headline,
          about: t.premium_about,
          insights: t.premium_insights,
          price_analysis: t.premium_price_analysis,
          supportive_themes: t.premium_supportive_themes,
          critical_themes: t.premium_critical_themes,
          sentiment_pct: t.premium_sentiment_pct,
        };
      }
      
      // Add derivatives data if available (major tokens only)
      if (t.funding_rate !== undefined || t.open_interest !== undefined || t.liquidations_24h) {
        tokenData.derivatives = {
          funding_rate: t.funding_rate,
          open_interest: t.open_interest,
          liquidations_24h: t.liquidations_24h,
        };
      }
      
      // Add social enrichment for deep analysis
      if (isDeepAnalysis) {
        tokenData.social_enrichment = {
          interactions_24h: t.interactions_24h,
          top_creators: t.top_creators?.slice?.(0, 5),
          top_creators_count: t.top_creators_count,
        };
      }
      
      // Clean up undefined values
      return Object.fromEntries(Object.entries(tokenData).filter(([_, v]) => v !== undefined));
    }), null, 2));
    base.push('```');
  }
  
  // Add STOCK data (for stock queries)
  if (data.stocks && data.stocks.length > 0) {
    base.push(``);
    base.push(`## Stock Data (RICH - use ALL of this):`);
    base.push('```json');
    base.push(JSON.stringify(data.stocks.slice(0, 15).map((s: RichStock) => ({
      symbol: s.symbol,
      name: s.name,
      sector: s.sector,
      industry: s.industry,
      exchange: s.exchange,
      // Price data
      price_usd: s.price_usd,
      change_pct: s.change_pct,
      volume: s.volume,
      market_cap: s.market_cap,
      high_52w: s.high_52w,
      low_52w: s.low_52w,
      // Technicals
      rsi_14: s.rsi_14,
      macd_line: s.macd_line,
      macd_signal: s.macd_signal,
      sma_20: s.sma_20,
      sma_50: s.sma_50,
      sma_200: s.sma_200,
      technical_signal: s.technical_signal,
      // Fundamentals
      pe_ratio: s.pe_ratio,
      eps: s.eps,
      dividend_yield: s.dividend_yield,
      // Company info
      employees: s.employees,
      description: s.description?.slice(0, 200),
    })), null, 2));
    base.push('```');
  }
  
  // Add stock gainers/losers if available
  if (data.stockGainers && data.stockGainers.length > 0) {
    base.push(``);
    base.push(`## Top Stock Gainers:`);
    base.push('```json');
    base.push(JSON.stringify(data.stockGainers.slice(0, 5).map((s: RichStock) => ({
      symbol: s.symbol,
      name: s.name,
      price_usd: s.price_usd,
      change_pct: s.change_pct,
      sector: s.sector,
      pe_ratio: s.pe_ratio,
    })), null, 2));
    base.push('```');
  }
  
  if (data.stockLosers && data.stockLosers.length > 0) {
    base.push(``);
    base.push(`## Top Stock Losers:`);
    base.push('```json');
    base.push(JSON.stringify(data.stockLosers.slice(0, 5).map((s: RichStock) => ({
      symbol: s.symbol,
      name: s.name,
      price_usd: s.price_usd,
      change_pct: s.change_pct,
      sector: s.sector,
      pe_ratio: s.pe_ratio,
    })), null, 2));
    base.push('```');
  }
  
  // Add gainers/losers if available (for market overview)
  if (data.gainers && data.gainers.length > 0) {
    base.push(``);
    base.push(`## Top Gainers:`);
    base.push('```json');
    base.push(JSON.stringify(data.gainers.slice(0, 5).map((t: any) => ({
      symbol: t.canonical_symbol,
      name: t.name,
      price_usd: t.price_usd,
      change_24h_pct: t.change_24h_pct,
      galaxy_score: t.galaxy_score,
      sentiment: t.sentiment,
      ai_summary: t.ai_summary?.slice?.(0, 200) || t.ai_summary_short,
    })), null, 2));
    base.push('```');
  }
  
  if (data.losers && data.losers.length > 0) {
    base.push(``);
    base.push(`## Top Losers:`);
    base.push('```json');
    base.push(JSON.stringify(data.losers.slice(0, 5).map((t: any) => ({
      symbol: t.canonical_symbol,
      name: t.name,
      price_usd: t.price_usd,
      change_24h_pct: t.change_24h_pct,
      galaxy_score: t.galaxy_score,
      sentiment: t.sentiment,
      ai_summary: t.ai_summary?.slice?.(0, 200) || t.ai_summary_short,
    })), null, 2));
    base.push('```');
  }
  
  // Add FOREX data (for forex/metals queries)
  if (data.forex && data.forex.length > 0) {
    const now = Date.now();
    base.push(``);
    base.push(`## Forex/Precious Metals Data:`);
    base.push(`**CRITICAL: Use ONLY these prices from the database. Do NOT use training data for precious metals prices.**`);
    base.push('```json');
    base.push(JSON.stringify(data.forex.map((f: any) => {
      const updateTime = f.price_updated_at || f.updated_at;
      const ageSeconds = updateTime ? Math.round((now - new Date(updateTime).getTime()) / 1000) : null;
      const ageLabel = ageSeconds !== null 
        ? (ageSeconds < 60 ? `${ageSeconds}s ago` : `${Math.round(ageSeconds / 60)}m ago`)
        : 'unknown';
      
      return {
        pair: f.pair,
        display_name: f.display_name,
        rate: f.rate,
        change_24h_pct: f.change_24h_pct,
        high_24h: f.high_24h,
        low_24h: f.low_24h,
        rsi_14: f.rsi_14,
        sma_20: f.sma_20,
        sma_50: f.sma_50,
        sma_200: f.sma_200,
        technical_signal: f.technical_signal,
        data_freshness: ageLabel,
        price_updated_at: updateTime,
      };
    }), null, 2));
    base.push('```');
    base.push(`**When responding about precious metals, always mention the current rate from above and the data freshness.**`);
  }
  
  const hasTokens = data.tokens.length > 0;
  const hasStocks = data.stocks && data.stocks.length > 0;
  const hasForex = data.forex && data.forex.length > 0;
  
  if (!hasTokens && !hasStocks && !hasForex && intent.intent !== 'general_chat') {
    base.push(``);
    base.push(`## Data Status: No data available for this query.`);
    base.push(`Acknowledge this and offer to help with something else.`);
  }
  
  return base.join('\n');
}

export async function streamLLMResponse(
  messages: Message[],
  systemPrompt: string,
  intent: Intent
): Promise<LLMResult> {
  const isSimple = ['price', 'derivatives', 'verification'].includes(intent);
  
  for (const provider of PROVIDERS) {
    const apiKey = Deno.env.get(provider.key);
    if (!apiKey) {
      console.log(`[LLM] Skipping ${provider.name}: no API key`);
      continue;
    }
    
    try {
      const model = isSimple ? provider.model : provider.modelComplex;
      console.log(`[LLM] Trying ${provider.name} with ${model}`);
      
      const stream = await callProvider(provider, apiKey, messages, systemPrompt, model);
      if (stream) {
        console.log(`[LLM] Success with ${provider.name}`);
        return {
          stream,
          provider: provider.name,
          model,
        };
      }
    } catch (e) {
      console.error(`[LLM] ${provider.name} failed:`, e);
    }
  }
  
  // All providers failed - return error stream
  return {
    stream: createErrorStream("I'm having trouble connecting to my brain right now. Please try again in a moment! 🧟"),
    provider: 'none',
    model: 'error',
  };
}

// FIX #11: Ensure SSE format matches frontend parser exactly
function createErrorStream(message: string): ReadableStream {
  return new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      // Match exact OpenAI SSE format expected by frontend
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: message } }] })}\n\n`));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
}

async function callProvider(
  provider: { name: string; url: string },
  apiKey: string,
  messages: Message[],
  systemPrompt: string,
  model: string
): Promise<ReadableStream | null> {
  const allMessages = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];
  
  // Handle Anthropic differently
  if (provider.name === 'anthropic') {
    return callAnthropic(apiKey, allMessages, model);
  }
  
  // OpenAI-compatible (Lovable AI Gateway, OpenAI)
  const response = await fetch(provider.url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: allMessages,
      stream: true,
    }),
  });
  
  if (!response.ok) {
    console.error(`[LLM] ${provider.name} returned ${response.status}`);
    return null;
  }
  
  return response.body;
}

// FIX #11: Anthropic stream transformer to match OpenAI SSE format exactly
async function callAnthropic(
  apiKey: string,
  messages: Message[],
  model: string
): Promise<ReadableStream | null> {
  // Extract system message
  const systemMsg = messages.find(m => m.role === 'system')?.content || '';
  const otherMsgs = messages.filter(m => m.role !== 'system');
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: systemMsg,
      messages: otherMsgs.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
      stream: true,
    }),
  });
  
  if (!response.ok) {
    console.error(`[LLM] Anthropic returned ${response.status}`);
    return null;
  }
  
  const reader = response.body?.getReader();
  if (!reader) return null;
  
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = '';
  
  return new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        
        if (done) {
          // FIX #11: Ensure [DONE] is sent at end
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
          return;
        }
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              // FIX #11: Convert to exact OpenAI format
              const openaiFormat = {
                choices: [{ delta: { content: parsed.delta.text } }],
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(openaiFormat)}\n\n`));
            }
          } catch {
            // Ignore parse errors
          }
        }
      } catch (e) {
        console.error('[LLM] Anthropic stream error:', e);
        controller.error(e);
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}
