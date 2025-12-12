import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { loadContext, saveMessage, updateSessionAssets } from "./context.ts";
import { detectIntent, RouteConfig } from "./router.ts";
import { resolveEntities, ResolvedAsset } from "./resolver.ts";
import { executeTools, ToolResults } from "./orchestrator.ts";
import { streamLLMResponse, buildSystemPrompt } from "./llm.ts";

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
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const body = await req.json();
    
    // Handle usage check
    if (body.action === 'get_usage') {
      return handleUsageCheck(req, supabase);
    }

    const { messages } = body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Messages required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get client info for rate limiting
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                     req.headers.get('x-real-ip') || 'unknown';
    const sessionId = `session_${hashString(clientIP)}`;
    
    // Check if admin (bypasses rate limit)
    const authHeader = req.headers.get('authorization');
    const isAdmin = await checkAdminStatus(supabase, authHeader);
    
    // Rate limiting for non-admins
    if (!isAdmin) {
      const rateCheck = await checkRateLimit(supabase, clientIP);
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
    const context = await loadContext(supabase, sessionId, messages);
    console.log(`[Agent] Context loaded: ${context.recentAssets.length} assets, ${context.recentAddresses.length} addresses`);

    // Step 2: Detect intent and get routing config
    const routeConfig = detectIntent(userMessage, context);
    console.log(`[Agent] Intent: ${routeConfig.intent}, tools: ${JSON.stringify(routeConfig)}`);

    // Step 3: Resolve entities (tickers, addresses)
    const resolvedAssets = await resolveEntities(supabase, userMessage, context);
    console.log(`[Agent] Resolved ${resolvedAssets.length} assets:`, resolvedAssets.map(a => a.symbol));

    // Step 4: Execute tools in parallel
    const toolResults = await executeTools(supabase, routeConfig, resolvedAssets);
    console.log(`[Agent] Tools executed:`, Object.keys(toolResults).filter(k => toolResults[k as keyof ToolResults]));

    // Step 5: Build system prompt with context
    const systemPrompt = buildSystemPrompt(context, resolvedAssets, toolResults, routeConfig);

    // Step 6: Stream LLM response
    const stream = await streamLLMResponse(messages, systemPrompt, routeConfig.intent);

    // Save message to persistent storage (async, don't block response)
    saveMessage(supabase, sessionId, 'user', userMessage).catch(console.error);
    
    // Update session with resolved assets
    if (resolvedAssets.length > 0) {
      updateSessionAssets(supabase, sessionId, resolvedAssets.map(a => a.symbol)).catch(console.error);
    }

    // Log usage (async)
    const totalLatency = Date.now() - startTime;
    logUsage(supabase, {
      clientIP,
      sessionId,
      intent: routeConfig.intent,
      assets: resolvedAssets.map(a => a.symbol),
      toolsUsed: Object.keys(toolResults).filter(k => toolResults[k as keyof ToolResults]),
      totalLatencyMs: totalLatency,
    }).catch(console.error);

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('[Agent] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Simple hash function for session IDs
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

async function checkRateLimit(supabase: any, clientIP: string): Promise<{ allowed: boolean; remaining: number }> {
  // Get today's date in ET timezone
  const now = new Date();
  const etOffset = -5; // ET is UTC-5 (or -4 during DST)
  const etNow = new Date(now.getTime() + (etOffset * 60 * 60 * 1000));
  const todayStart = new Date(etNow.getFullYear(), etNow.getMonth(), etNow.getDate());
  todayStart.setTime(todayStart.getTime() - (etOffset * 60 * 60 * 1000)); // Convert back to UTC
  
  const { count } = await supabase
    .from('ai_usage_logs')
    .select('*', { count: 'exact', head: true })
    .eq('client_ip', clientIP)
    .gte('created_at', todayStart.toISOString());
  
  const used = count || 0;
  const remaining = Math.max(0, DAILY_MESSAGE_LIMIT - used);
  
  return { allowed: remaining > 0, remaining };
}

async function handleUsageCheck(req: Request, supabase: any): Promise<Response> {
  const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                   req.headers.get('x-real-ip') || 'unknown';
  
  const authHeader = req.headers.get('authorization');
  const isAdmin = await checkAdminStatus(supabase, authHeader);
  
  if (isAdmin) {
    return new Response(JSON.stringify({ remaining: -1, isAdmin: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  const { remaining } = await checkRateLimit(supabase, clientIP);
  return new Response(JSON.stringify({ remaining, isAdmin: false }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function logUsage(supabase: any, data: {
  clientIP: string;
  sessionId: string;
  intent: string;
  assets: string[];
  toolsUsed: string[];
  totalLatencyMs: number;
}) {
  await supabase.from('ai_usage_logs').insert({
    provider: 'lovable',
    model: 'google/gemini-2.5-flash',
    input_tokens: 0, // Will be updated by LLM caller
    output_tokens: 0,
    estimated_cost_millicents: 0,
    client_ip: data.clientIP,
    session_id: data.sessionId,
    intent: data.intent,
    assets_queried: data.assets,
    tools_used: data.toolsUsed,
    total_latency_ms: data.totalLatencyMs,
    success: true,
  });
}
