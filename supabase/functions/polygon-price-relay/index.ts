import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Leader election configuration
const LEADER_ID = 'polygon-price-relay';
const HEARTBEAT_INTERVAL = 5000; // 5 seconds
const LEADER_TIMEOUT = 15000; // 15 seconds
const BATCH_INTERVAL = 1000; // 1 second batch upserts

interface PriceUpdate {
  ticker: string;
  price: number;
  change24h: number;
  display: string;
  volume?: number;
}

let ws: WebSocket | null = null;
let isLeader = false;
let heartbeatTimer: number | null = null;
let batchTimer: number | null = null;
const priceBuffer = new Map<string, PriceUpdate>();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const polygonKey = Deno.env.get('POLYGON_API_KEY');

    if (!polygonKey) {
      throw new Error('POLYGON_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Try to become leader
    const becameLeader = await tryBecomeLeader(supabase);
    
    if (!becameLeader) {
      console.log('Another instance is already running as leader');
      return new Response(
        JSON.stringify({ message: 'Another instance is already the leader' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Became leader, starting WebSocket connection...');
    isLeader = true;

    // Get mapped tickers with polygon_ticker
    const { data: tickers } = await supabase
      .from('ticker_mappings')
      .select('symbol, polygon_ticker, display_name')
      .not('polygon_ticker', 'is', null)
      .eq('type', 'crypto')
      .eq('is_active', true);

    if (!tickers || tickers.length === 0) {
      throw new Error('No mapped tickers found');
    }

    console.log(`📊 Subscribing to ${tickers.length} tickers`);

    // Start WebSocket connection
    await startWebSocket(supabase, polygonKey, tickers);

    // Start heartbeat
    startHeartbeat(supabase);

    // Start batch processor
    startBatchProcessor(supabase);

    return new Response(
      JSON.stringify({ 
        message: 'Polygon price relay started',
        tickers: tickers.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error:', error);
    cleanup();
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function tryBecomeLeader(supabase: any): Promise<boolean> {
  try {
    // Try to claim leadership
    const { error } = await supabase
      .from('price_sync_leader')
      .upsert({
        id: 'singleton',
        instance_id: LEADER_ID,
        heartbeat_at: new Date().toISOString()
      }, {
        onConflict: 'id',
        ignoreDuplicates: false
      });

    if (error) {
      // Check if another instance is leader
      const { data: leader } = await supabase
        .from('price_sync_leader')
        .select('instance_id, heartbeat_at')
        .eq('id', 'singleton')
        .single();

      if (leader) {
        const lastHeartbeat = new Date(leader.heartbeat_at).getTime();
        const now = Date.now();
        
        // Take over if leader is stale
        if (now - lastHeartbeat > LEADER_TIMEOUT) {
          console.log('⚠️ Previous leader is stale, taking over...');
          await supabase
            .from('price_sync_leader')
            .update({
              instance_id: LEADER_ID,
              heartbeat_at: new Date().toISOString()
            })
            .eq('id', 'singleton');
          return true;
        }
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Leader election error:', error);
    return false;
  }
}

function startHeartbeat(supabase: any) {
  heartbeatTimer = setInterval(async () => {
    if (!isLeader) {
      cleanup();
      return;
    }

    try {
      await supabase
        .from('price_sync_leader')
        .update({ heartbeat_at: new Date().toISOString() })
        .eq('id', 'singleton')
        .eq('instance_id', LEADER_ID);
    } catch (error) {
      console.error('Heartbeat error:', error);
    }
  }, HEARTBEAT_INTERVAL);
}

function startBatchProcessor(supabase: any) {
  batchTimer = setInterval(async () => {
    if (priceBuffer.size === 0) return;

    const updates = Array.from(priceBuffer.values());
    priceBuffer.clear();

    try {
      const { error } = await supabase
        .from('live_prices')
        .upsert(updates, {
          onConflict: 'ticker',
          ignoreDuplicates: false
        });

      if (error) {
        console.error('Batch upsert error:', error);
      } else {
        console.log(`✅ Updated ${updates.length} prices`);
      }
    } catch (error) {
      console.error('Batch processing error:', error);
    }
  }, BATCH_INTERVAL);
}

async function startWebSocket(supabase: any, apiKey: string, tickers: any[]) {
  const wsUrl = `wss://socket.polygon.io/crypto`;
  
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('🔌 WebSocket connected to Polygon');
    
    // Authenticate
    ws?.send(JSON.stringify({ action: 'auth', params: apiKey }));

    // Subscribe to tickers (prefer USD, fallback USDT)
    const symbols = tickers.map(t => {
      const polygonTicker = t.polygon_ticker;
      return `X:${polygonTicker}`;
    });

    ws?.send(JSON.stringify({
      action: 'subscribe',
      params: symbols.join(',')
    }));

    console.log(`📡 Subscribed to ${symbols.length} symbols`);
  };

  ws.onmessage = (event) => {
    try {
      const messages = JSON.parse(event.data);
      
      if (!Array.isArray(messages)) return;

      for (const msg of messages) {
        // Handle ticker updates
        if (msg.ev === 'XT') {
          const ticker = msg.pair?.replace('X:', '') || '';
          if (!ticker) continue;

          const price = msg.p || 0;
          const change = msg.d || 0; // Daily change percentage
          
          priceBuffer.set(ticker, {
            ticker,
            price,
            change24h: change,
            display: ticker,
            volume: msg.v,
          });
        }
        
        // Handle status messages
        if (msg.ev === 'status') {
          console.log('Status:', msg.message);
        }
      }
    } catch (error) {
      console.error('Message parsing error:', error);
    }
  };

  ws.onerror = (error) => {
    console.error('❌ WebSocket error:', error);
  };

  ws.onclose = () => {
    console.log('🔌 WebSocket closed');
    
    // Attempt reconnect after delay if still leader
    if (isLeader) {
      setTimeout(() => {
        console.log('🔄 Attempting reconnect...');
        startWebSocket(supabase, apiKey, tickers);
      }, 5000);
    }
  };
}

function cleanup() {
  console.log('🧹 Cleaning up...');
  
  isLeader = false;
  
  if (ws) {
    ws.close();
    ws = null;
  }
  
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  
  if (batchTimer) {
    clearInterval(batchTimer);
    batchTimer = null;
  }
  
  priceBuffer.clear();
}

// Cleanup on shutdown
addEventListener('beforeunload', () => {
  cleanup();
});
