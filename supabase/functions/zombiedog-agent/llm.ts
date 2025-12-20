// LLM Caller: Lovable AI → OpenAI → Anthropic fallback chain
// FIXES: #4 (tool data contract), #5 (actual provider logging), #11 (SSE format)

import { SessionContext } from "./context.ts";
import { ResolvedAsset } from "./resolver.ts";
import { ToolResults, MarketSummary } from "./orchestrator.ts";
import { RouteConfig, Intent } from "./router.ts";
import { ParsedIntent } from "./intent-parser.ts";
import { FetchedData, SECTOR_TOKENS } from "./data-fetcher.ts";

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

// NEW: Intent-based prompt builder for LLM intent parser path
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
    `- Keep responses concise (2-4 paragraphs)`,
    `- End EVERY response with: "Not financial advice. I'm a zombie dog. 🐕"`,
    `- Use $ for prices, % for changes`,
    `- Don't be overly formal`,
    `- Respond in the SAME LANGUAGE the user writes in`,
    `- CRITICAL: ONLY use data from the JSON provided. NEVER guess or invent numbers.`,
    `- If data is missing for something, say "data unavailable" — do NOT fabricate.`,
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
  
  // Add intent-specific instructions
  switch (intent.intent) {
    case 'market_overview':
      base.push(`## MARKET OVERVIEW TASK:`);
      base.push(`Give a comprehensive market snapshot. Lead with overall tone, then highlight leaders and laggards.`);
      if (data.marketSummary) {
        base.push(``);
        base.push(`**Pre-computed summary:**`);
        base.push(`- Total assets: ${data.marketSummary.total}`);
        base.push(`- Green: ${data.marketSummary.greenCount} | Red: ${data.marketSummary.redCount}`);
        base.push(`- Breadth: ${data.marketSummary.breadthPct}%`);
        base.push(`- Leaders: ${data.marketSummary.leaders.map(l => `${l.symbol} ${l.change >= 0 ? '+' : ''}${l.change.toFixed(1)}%`).join(', ')}`);
        base.push(`- Laggards: ${data.marketSummary.laggards.map(l => `${l.symbol} ${l.change >= 0 ? '+' : ''}${l.change.toFixed(1)}%`).join(', ')}`);
        if (data.marketSummary.avgGalaxyScore) base.push(`- Avg Galaxy Score: ${data.marketSummary.avgGalaxyScore}/100`);
      }
      break;
      
    case 'sector_analysis':
      base.push(`## SECTOR ANALYSIS TASK:`);
      base.push(`Analyze the ${intent.sector?.toUpperCase() || 'crypto'} sector. Which tokens are performing? Any standouts?`);
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
      }
      break;
      
    case 'token_lookup':
      base.push(`## TOKEN LOOKUP TASK:`);
      base.push(`Analyze these specific tokens. Include: price, 24h change, market cap, sentiment, technicals if available.`);
      base.push(`Present the key metrics clearly.`);
      break;
      
    case 'comparison':
      base.push(`## COMPARISON TASK:`);
      base.push(`Compare these tokens head-to-head: ${intent.tickers.join(' vs ')}`);
      base.push(`Include: price, 24h change, market cap, sentiment/galaxy score.`);
      base.push(`Give your take on which looks stronger right now and why.`);
      break;
      
    case 'trending':
      base.push(`## TRENDING TASK:`);
      if (intent.action === 'gainers') {
        base.push(`Show the TOP GAINERS. Highlight the biggest movers and any interesting patterns.`);
      } else if (intent.action === 'losers') {
        base.push(`Show the BIGGEST LOSERS. What's getting rekt and why might that be?`);
      } else if (intent.action === 'volume') {
        base.push(`Show the highest VOLUME tokens. Where is the action happening?`);
      } else {
        base.push(`Show what's TRENDING. Use Galaxy Score and social metrics if available.`);
      }
      break;
      
    case 'news':
      base.push(`## NEWS/SENTIMENT TASK:`);
      base.push(`Summarize the latest news/sentiment for ${intent.tickers.length > 0 ? intent.tickers.join(', ') : 'the market'}.`);
      base.push(`What's the narrative? Use AI summaries and top posts if available.`);
      break;
      
    case 'general_chat':
      base.push(`## GENERAL CHAT MODE:`);
      base.push(`Respond casually and friendly, staying in character as ZombieDog.`);
      base.push(`If greeting, say hi and mention you can help with crypto/stock prices, market analysis, safety checks, etc.`);
      base.push(`If asking what you can do, list: price checks, market overviews, token analysis, safety scans, news/sentiment, comparisons.`);
      base.push(`Keep it to 2-3 sentences. Skip the "Not financial advice" footer for greetings.`);
      break;
  }
  
  // Add the actual data
  if (data.tokens.length > 0) {
    base.push(``);
    base.push(`## Token Data (JSON):`);
    base.push('```json');
    base.push(JSON.stringify(data.tokens.slice(0, 20).map((t: any) => ({
      symbol: t.canonical_symbol,
      name: t.name,
      price: t.price_usd,
      change_24h_pct: t.change_24h_pct,
      market_cap: t.market_cap,
      volume_24h: t.volume_24h_usd,
      galaxy_score: t.galaxy_score,
      sentiment: t.sentiment,
      rsi: t.rsi_14,
      ai_summary: t.lc_ai_summary?.slice?.(0, 200),
    })), null, 2));
    base.push('```');
  } else if (intent.intent !== 'general_chat') {
    base.push(``);
    base.push(`## Data Status: No token data available for this query.`);
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
