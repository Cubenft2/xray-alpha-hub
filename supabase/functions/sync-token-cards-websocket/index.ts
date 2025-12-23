import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WS_WORKER_PRICES_URL = "https://crypto-stream.xrprat.workers.dev/prices";

interface WorkerPriceData {
  symbol: string;
  price: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  vwap?: number;
  timestamp?: number;
  updated_at?: string;
}

// Parse symbol from worker format (X:BTCUSD -> BTC)
function parseSymbol(workerSymbol: string): string {
  return workerSymbol.replace("X:", "").replace("USD", "").toUpperCase();
}

// Calculate 24h change percentage from open/close
function calculateChange24h(open: number | undefined, close: number | undefined): number | null {
  if (!open || !close || open === 0) return null;
  return ((close - open) / open) * 100;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[sync-token-cards-websocket] Starting sync...");

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch prices from Cloudflare Worker
    console.log("[sync-token-cards-websocket] Fetching from Worker:", WS_WORKER_PRICES_URL);
    const response = await fetch(WS_WORKER_PRICES_URL);
    
    if (!response.ok) {
      throw new Error(`Worker API error: ${response.status} ${response.statusText}`);
    }

    const workerData = await response.json();
    const prices: Record<string, WorkerPriceData> = workerData.prices || {};
    const priceCount = Object.keys(prices).length;
    
    console.log(`[sync-token-cards-websocket] Received ${priceCount} prices from Worker`);

    if (priceCount === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No prices available from Worker",
          duration_ms: Date.now() - startTime 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare upsert data
    const updates: Array<{
      canonical_symbol: string;
      ws_price_usd: number;
      ws_open_24h: number | null;
      ws_high_24h: number | null;
      ws_low_24h: number | null;
      ws_close_24h: number | null;
      ws_vwap_24h: number | null;
      ws_volume_24h: number | null;
      ws_change_24h_pct: number | null;
      ws_price_updated_at: string;
    }> = [];

    for (const [workerSymbol, priceData] of Object.entries(prices)) {
      const symbol = parseSymbol(workerSymbol);
      
      // Skip invalid data
      if (!priceData.price || priceData.price <= 0) continue;

      updates.push({
        canonical_symbol: symbol,
        ws_price_usd: priceData.price,
        ws_open_24h: priceData.open ?? null,
        ws_high_24h: priceData.high ?? null,
        ws_low_24h: priceData.low ?? null,
        ws_close_24h: priceData.close ?? null,
        ws_vwap_24h: priceData.vwap ?? null,
        ws_volume_24h: priceData.volume ?? null,
        ws_change_24h_pct: calculateChange24h(priceData.open, priceData.close),
        ws_price_updated_at: priceData.updated_at || new Date().toISOString(),
      });
    }

    console.log(`[sync-token-cards-websocket] Prepared ${updates.length} updates`);

    // Batch upsert in chunks of 100
    const BATCH_SIZE = 100;
    let upsertedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);
      
      const { error } = await supabase
        .from("token_cards")
        .upsert(batch, { 
          onConflict: "canonical_symbol",
          ignoreDuplicates: false 
        });

      if (error) {
        console.error(`[sync-token-cards-websocket] Batch error:`, error);
        errorCount += batch.length;
      } else {
        upsertedCount += batch.length;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[sync-token-cards-websocket] Completed: ${upsertedCount} updated, ${errorCount} errors, ${duration}ms`);

    // Log API call
    await supabase.from("external_api_calls").insert({
      function_name: "sync-token-cards-websocket",
      api_name: "cloudflare_worker",
      call_count: 1,
      success: errorCount === 0,
      error_message: errorCount > 0 ? `${errorCount} upsert errors` : null,
    });

    return new Response(
      JSON.stringify({
        success: true,
        prices_received: priceCount,
        tokens_updated: upsertedCount,
        errors: errorCount,
        duration_ms: duration,
        worker_health: workerData.health,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[sync-token-cards-websocket] Error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        duration_ms: Date.now() - startTime,
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
