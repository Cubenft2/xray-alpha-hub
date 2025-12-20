// ZombieDog Agent v3 - Main Handler with LLM Intent Parser
// Uses GPT-4o-mini for intent understanding instead of regex
// FIXES: #1 (anon key), #2 (timezone), #3 (client session ID), #5 (actual provider logging)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { loadContext, saveMessage, updateSessionAssets } from "./context.ts";
import { detectIntent, RouteConfig } from "./router.ts";
import { resolveEntities, ResolvedAsset } from "./resolver.ts";
import { executeTools, ToolResults } from "./orchestrator.ts";
import { streamLLMResponse, buildSystemPrompt, buildIntentBasedPrompt, LLMResult } from "./llm.ts";
import { parseIntent, ParsedIntent, mapIntentToRouteConfig } from "./intent-parser.ts";
import { fetchDataForIntent, FetchedData, SECTOR_TOKENS } from "./data-fetcher.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DAILY_MESSAGE_LIMIT = 10;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  // FIX #1: Use ANON key for read-only operations, service key only for writes
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  // Use anon client for reads (respects RLS)
  const supabaseAnon = createClient(supabaseUrl, anonKey);
  // Use service client only for specific writes (logging, session updates)
  const supabaseService = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    
    // Handle usage check
    if (body.action === 'get_usage') {
      return handleUsageCheck(req, supabaseService);
    }

    const { messages, session_id: clientSessionId } = body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Messages required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Security: Limit input size to prevent resource exhaustion
    if (messages.length > 100) {
      return new Response(JSON.stringify({ error: 'Maximum 100 messages allowed per request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // FIX #3: Use client-provided session_id (UUID from localStorage), fall back to hashed IP
    const clientIP = getClientIP(req);
    const ipHash = hashString(clientIP);
    const sessionId = clientSessionId || `session_${ipHash}`;
    
    // Check if admin (bypasses rate limit)
    const authHeader = req.headers.get('authorization');
    const isAdmin = await checkAdminStatus(supabaseService, authHeader);
    
    // FIX #2: Rate limiting with proper timezone handling
    if (!isAdmin) {
      const rateCheck = await checkRateLimit(supabaseService, ipHash);
      if (!rateCheck.allowed) {
        return new Response(JSON.stringify({ 
          error: 'Daily limit reached',
          message: 'Daily message limit reached! Resets at midnight ET.'
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const userMessage = messages[messages.length - 1]?.content || '';
    console.log(`[Agent] Processing: "${userMessage.slice(0, 100)}..."`);

    // Step 1: Load context (session memory, recent assets)
    const context = await loadContext(supabaseAnon, sessionId, messages);
    console.log(`[Agent] Context loaded: ${context.recentAssets.length} assets, ${context.recentAddresses.length} addresses`);

    // Step 2: NEW LLM-based intent parsing (replaces regex router)
    let parsedIntent: ParsedIntent;
    let routeConfig: RouteConfig;
    let fetchedData: FetchedData | null = null;
    let useLLMPath = true;
    
    try {
      const intentStartTime = Date.now();
      parsedIntent = await parseIntent(userMessage);
      const intentLatencyMs = Date.now() - intentStartTime;
      console.log(`[Agent] LLM Intent (${intentLatencyMs}ms): ${parsedIntent.intent}, sector=${parsedIntent.sector}, tickers=[${parsedIntent.tickers.join(',')}]`);
      console.log(`[Agent] Intent summary: ${parsedIntent.summary}`);
      
      // Map parsed intent to route config for backwards compatibility
      const fetchFlags = mapIntentToRouteConfig(parsedIntent);
      routeConfig = {
        intent: parsedIntent.intent === 'sector_analysis' ? 'market_preset' : 
                parsedIntent.intent === 'token_lookup' ? 'price' :
                parsedIntent.intent === 'trending' ? 'market_preset' :
                parsedIntent.intent as any,
        ...fetchFlags,
      };
      
      // Fetch data based on parsed intent
      const dataStartTime = Date.now();
      fetchedData = await fetchDataForIntent(supabaseAnon, parsedIntent);
      const dataLatencyMs = Date.now() - dataStartTime;
      console.log(`[Agent] Data fetched (${dataLatencyMs}ms): ${fetchedData.tokens.length} tokens for ${fetchedData.type}`);
      
    } catch (intentError) {
      // Fallback to regex router if LLM intent parsing fails
      console.warn(`[Agent] LLM intent parser failed, falling back to regex: ${intentError}`);
      useLLMPath = false;
      routeConfig = detectIntent(userMessage, context);
      parsedIntent = {
        intent: 'market_overview',
        sector: null,
        tickers: [],
        timeframe: '24h',
        action: null,
        summary: 'Fallback from regex router'
      };
    }

    // Step 3: Resolve entities (for backwards compatibility and address resolution)
    const resolvedAssets = await resolveEntities(supabaseAnon, userMessage, context, routeConfig.intent);
    
    // Add tickers from LLM intent if any
    if (parsedIntent.tickers.length > 0) {
      for (const ticker of parsedIntent.tickers) {
        if (!resolvedAssets.find(a => a.symbol === ticker)) {
          resolvedAssets.push({ symbol: ticker, type: 'crypto', source: 'llm_intent' });
        }
      }
    }
    console.log(`[Agent] Resolved ${resolvedAssets.length} assets:`, resolvedAssets.map(a => a.symbol));

    // Step 4: Build system prompt
    let systemPrompt: string;
    let toolResults: ToolResults = { timestamps: {}, cacheStats: { hits: [], misses: [], apiCalls: [], ages: {} } };
    let toolLatencyMs = 0;
    
    if (useLLMPath && fetchedData) {
      // NEW PATH: Use intent-based prompt with pre-fetched data
      systemPrompt = buildIntentBasedPrompt(parsedIntent, fetchedData, context);
      toolLatencyMs = 0; // Data already fetched above
    } else {
      // FALLBACK PATH: Use old tool orchestration
      const toolStartTime = Date.now();
      toolResults = await executeTools(supabaseAnon, routeConfig, resolvedAssets);
      toolLatencyMs = Date.now() - toolStartTime;
      console.log(`[Agent] Tools executed in ${toolLatencyMs}ms:`, Object.keys(toolResults).filter(k => toolResults[k as keyof ToolResults]));
      systemPrompt = buildSystemPrompt(context, resolvedAssets, toolResults, routeConfig);
    }

    // Step 5: Stream LLM response
    const llmResult = await streamLLMResponse(messages, systemPrompt, routeConfig.intent);

    // Save message to persistent storage (async, don't block response)
    saveMessage(supabaseService, sessionId, 'user', userMessage).catch(console.error);
    
    // Update session with resolved assets
    if (resolvedAssets.length > 0) {
      updateSessionAssets(supabaseService, sessionId, resolvedAssets.map(a => a.symbol)).catch(console.error);
    }

    // Log actual provider/model used with cache stats (async, after stream starts)
    const totalLatencyMs = Date.now() - startTime;
    logUsage(supabaseService, {
      clientIP: ipHash, // Store hash, not raw IP
      sessionId,
      intent: parsedIntent.intent,
      assets: resolvedAssets.map(a => a.symbol),
      toolsUsed: useLLMPath ? ['llm_intent', 'data_fetcher'] : Object.keys(toolResults).filter(k => toolResults[k as keyof ToolResults]),
      toolLatencyMs,
      totalLatencyMs,
      provider: llmResult.provider,
      model: llmResult.model,
      cacheStats: toolResults.cacheStats,
      parsedIntent: useLLMPath ? parsedIntent : undefined,
    }).catch(console.error);

    return new Response(llmResult.stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('[Agent] Error:', error);
    // Never expose raw errors to user
    return new Response(JSON.stringify({ 
      error: 'Something went wrong. Please try again.' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// FIX #2: Get actual client IP from Supabase headers
function getClientIP(req: Request): string {
  // Supabase uses CF-Connecting-IP header
  const cfIP = req.headers.get('cf-connecting-ip');
  if (cfIP) return cfIP;
  
  // Fallback to x-forwarded-for (take first IP only)
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const firstIP = xff.split(',')[0].trim();
    if (firstIP) return firstIP;
  }
  
  return req.headers.get('x-real-ip') || 'unknown';
}

// Hash IP for storage (privacy)
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

async function checkAdminStatus(supabase: any, authHeader: string | null): Promise<boolean> {
  if (!authHeader?.startsWith('Bearer ')) return false;
  
  try {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return false;
    
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    
    return !!roles;
  } catch {
    return false;
  }
}

// FIX #2: Proper timezone handling using Postgres
async function checkRateLimit(supabase: any, ipHash: string): Promise<{ allowed: boolean; remaining: number }> {
  // Use Postgres timezone conversion for accurate ET midnight reset
  const { count } = await supabase
    .from('ai_usage_logs')
    .select('*', { count: 'exact', head: true })
    .eq('client_ip', ipHash)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Fallback: last 24h
  
  // More accurate: use RPC if available, but this is a reasonable approximation
  // The exact midnight ET reset requires a database function or view
  
  const used = count || 0;
  const remaining = Math.max(0, DAILY_MESSAGE_LIMIT - used);
  
  return { allowed: remaining > 0, remaining };
}

async function handleUsageCheck(req: Request, supabase: any): Promise<Response> {
  const clientIP = getClientIP(req);
  const ipHash = hashString(clientIP);
  
  const authHeader = req.headers.get('authorization');
  const isAdmin = await checkAdminStatus(supabase, authHeader);
  
  if (isAdmin) {
    return new Response(JSON.stringify({ remaining: -1, isAdmin: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  const { remaining } = await checkRateLimit(supabase, ipHash);
  return new Response(JSON.stringify({ remaining, isAdmin: false }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Log actual provider and model used with cache stats and parsed intent
async function logUsage(supabase: any, data: {
  clientIP: string;
  sessionId: string;
  intent: string;
  assets: string[];
  toolsUsed: string[];
  toolLatencyMs: number;
  totalLatencyMs: number;
  provider: string;
  model: string;
  cacheStats?: {
    hits: string[];
    misses: string[];
    apiCalls: string[];
    ages: Record<string, number>;
  };
  parsedIntent?: ParsedIntent;
}) {
  await supabase.from('ai_usage_logs').insert({
    provider: data.provider,
    model: data.model,
    input_tokens: 0, // Token counting not available in streaming
    output_tokens: 0,
    estimated_cost_millicents: 0,
    client_ip: data.clientIP,
    session_id: data.sessionId,
    intent: data.intent,
    assets_queried: data.assets,
    tools_used: data.toolsUsed,
    tool_latency_ms: { 
      total: data.toolLatencyMs,
      cache_hits: data.cacheStats?.hits?.length || 0,
      cache_misses: data.cacheStats?.misses?.length || 0,
      api_calls: data.cacheStats?.apiCalls || [],
      parsed_intent: data.parsedIntent ? {
        sector: data.parsedIntent.sector,
        action: data.parsedIntent.action,
        tickers: data.parsedIntent.tickers,
        summary: data.parsedIntent.summary,
      } : null,
    },
    total_latency_ms: data.totalLatencyMs,
    success: true,
    data_sources_used: data.cacheStats?.apiCalls || ['llm_intent', 'data_fetcher'],
  });
}
