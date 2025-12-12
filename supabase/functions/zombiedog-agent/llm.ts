// LLM Caller: Lovable AI → OpenAI → Anthropic fallback chain

import { SessionContext } from "./context.ts";
import { ResolvedAsset } from "./resolver.ts";
import { ToolResults } from "./orchestrator.ts";
import { RouteConfig, Intent } from "./router.ts";

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
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

export function buildSystemPrompt(
  context: SessionContext,
  assets: ResolvedAsset[],
  tools: ToolResults,
  config: RouteConfig
): string {
  const parts: string[] = [
    `You are ZombieDog 🧟🐕, a battle-tested crypto & stocks market analyst with a no-BS attitude.`,
    `You speak casually but provide accurate, data-driven insights.`,
    `Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`,
    ``,
    `## Your Rules:`,
    `- NEVER ask clarifying questions. Use the data provided.`,
    `- If data is missing, say so briefly and move on.`,
    `- For prices: show symbol, price, 24h %, and source.`,
    `- For safety: show risk level, flags, and verdict.`,
    `- For content creation: output ONLY the requested content.`,
    `- Keep responses concise but informative.`,
    `- Respond in the SAME LANGUAGE the user writes in.`,
  ];
  
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
  
  // Add tool results
  if (tools.prices && tools.prices.length > 0) {
    parts.push('');
    parts.push('## 📊 Live Price Data:');
    for (const p of tools.prices) {
      const changeStr = p.change24h >= 0 ? `+${p.change24h.toFixed(2)}%` : `${p.change24h.toFixed(2)}%`;
      const mcapStr = p.marketCap ? ` | MCap: $${formatNumber(p.marketCap)}` : '';
      parts.push(`- ${p.symbol}: $${formatPrice(p.price)} (${changeStr})${mcapStr} [${p.source}]`);
    }
  }
  
  if (tools.social && tools.social.length > 0) {
    parts.push('');
    parts.push('## 📱 Social Sentiment (LunarCrush):');
    for (const s of tools.social) {
      const gs = s.galaxyScore ? `Galaxy: ${s.galaxyScore}` : '';
      const ar = s.altRank ? `AltRank: #${s.altRank}` : '';
      const sent = s.sentiment ? `Sentiment: ${s.sentiment}%` : '';
      parts.push(`- ${s.symbol}: ${[gs, ar, sent].filter(Boolean).join(' | ')}`);
    }
  }
  
  if (tools.derivs && tools.derivs.length > 0) {
    parts.push('');
    parts.push('## 📈 Derivatives Data:');
    for (const d of tools.derivs) {
      const fr = (d.fundingRate * 100).toFixed(4);
      parts.push(`- ${d.symbol}: Funding ${fr}% | Liq 24h: $${formatNumber(d.liquidations24h.total)}`);
    }
  }
  
  if (tools.security) {
    parts.push('');
    parts.push('## 🛡️ Security Analysis:');
    parts.push(`- Risk Level: ${tools.security.riskLevel}`);
    if (tools.security.flags.length > 0) {
      parts.push(`- Flags: ${tools.security.flags.join(', ')}`);
    }
    if (tools.security.liquidity) {
      parts.push(`- DEX Liquidity: $${formatNumber(tools.security.liquidity.dex)}`);
    }
  }
  
  if (tools.news && tools.news.length > 0) {
    parts.push('');
    parts.push('## 📰 Recent News:');
    for (const n of tools.news.slice(0, 3)) {
      parts.push(`- "${n.title}" — ${n.source}`);
    }
  }
  
  if (tools.charts) {
    parts.push('');
    parts.push('## 📉 Technical Indicators:');
    if (tools.charts.rsi) parts.push(`- RSI: ${tools.charts.rsi.toFixed(1)}`);
    if (tools.charts.sma20) parts.push(`- SMA20: $${formatPrice(tools.charts.sma20)}`);
    if (tools.charts.sma50) parts.push(`- SMA50: $${formatPrice(tools.charts.sma50)}`);
  }
  
  // Intent-specific instructions
  if (config.intent === 'content') {
    parts.push('');
    parts.push('## Content Creation Mode:');
    parts.push('Output ONLY the requested post/tweet/content. No extra commentary.');
  }
  
  if (config.intent === 'safety') {
    parts.push('');
    parts.push('## Safety Analysis Format:');
    parts.push('1. Token identified');
    parts.push('2. Risk Level (Low/Medium/High)');
    parts.push('3. Flags found');
    parts.push('4. Liquidity info');
    parts.push('5. Verdict (2 sentences max)');
  }
  
  return parts.join('\n');
}

export async function streamLLMResponse(
  messages: Message[],
  systemPrompt: string,
  intent: Intent
): Promise<ReadableStream> {
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
        return stream;
      }
    } catch (e) {
      console.error(`[LLM] ${provider.name} failed:`, e);
    }
  }
  
  // All providers failed - return error stream
  return new ReadableStream({
    start(controller) {
      const errorMsg = "I'm having trouble connecting to my brain right now. Please try again in a moment! 🧟";
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ choices: [{ delta: { content: errorMsg } }] })}\n\n`));
      controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
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
  
  // Transform Anthropic stream to OpenAI format
  const reader = response.body?.getReader();
  if (!reader) return null;
  
  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();
        return;
      }
      
      const text = new TextDecoder().decode(value);
      const lines = text.split('\n');
      
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            // Convert to OpenAI format
            const openaiFormat = {
              choices: [{ delta: { content: parsed.delta.text } }],
            };
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(openaiFormat)}\n\n`));
          }
        } catch {
          // Ignore parse errors
        }
      }
    },
  });
}

// Utility functions
function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(2);
  if (price >= 0.01) return price.toFixed(4);
  return price.toFixed(8);
}

function formatNumber(num: number): string {
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return num.toFixed(2);
}
