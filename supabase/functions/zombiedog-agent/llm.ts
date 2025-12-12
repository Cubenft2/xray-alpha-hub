// LLM Caller: Lovable AI → OpenAI → Anthropic fallback chain
// FIXES: #4 (tool data contract), #5 (actual provider logging), #11 (SSE format)

import { SessionContext } from "./context.ts";
import { ResolvedAsset } from "./resolver.ts";
import { ToolResults } from "./orchestrator.ts";
import { RouteConfig, Intent } from "./router.ts";

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
    `- If tool data is marked "MISSING", say "I don't have that data right now" — do NOT guess.`,
    `- For prices: show symbol, price, 24h %, and data age (e.g., "updated 42s ago").`,
    `- For safety: show risk level, flags, and verdict.`,
    `- For content creation: output ONLY the requested content.`,
    `- Keep responses concise but informative.`,
    `- Respond in the SAME LANGUAGE the user writes in.`,
    `- When data shows "_stale" source, mention it may be slightly delayed.`,
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
  
  // Add conversation context
  if (context.recentAssets.length > 0) {
    parts.push('');
    parts.push(`## Recent conversation context:`);
    parts.push(`Previously discussed: ${context.recentAssets.join(', ')}`);
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
  
  return parts.join('\n');
}

// FIX #5: Return provider/model info along with stream
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
