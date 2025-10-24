import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Leader election configuration
const LEADER_ID = 'polygon-price-relay';
const HEARTBEAT_INTERVAL = 5000; // 5 seconds
const LEADER_TIMEOUT = 30000; // 30 seconds (reduced from 60s for faster takeover)
const BATCH_INTERVAL = 1000; // 1 second batch upserts
const MAX_RECONNECT_ATTEMPTS = 5;

// Connection monitoring
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 3;

interface PriceUpdate {
  ticker: string;
  price: number;
  change24h: number;
  display: string;
  volume?: number;
}

// Connection state tracking
enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  CLOSING = 'closing',
  ERROR = 'error'
}

let ws: WebSocket | null = null;
let isLeader = false;
let heartbeatTimer: number | null = null;
let batchTimer: number | null = null;
let reconnectAttempts = 0;
let connectionState: ConnectionState = ConnectionState.DISCONNECTED;
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
  // CRITICAL: Close any existing WebSocket connection first
  if (ws && connectionState !== ConnectionState.CLOSING && connectionState !== ConnectionState.DISCONNECTED) {
    console.log('⚠️ Closing existing WebSocket connection before creating new one...');
    connectionState = ConnectionState.CLOSING;
    try {
      ws.close();
    } catch (error) {
      console.error('Error closing existing WebSocket:', error);
    }
    ws = null;
    // Wait for connection to fully close
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error(`❌ Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Stopping relay.`);
    await releaseLeadership(supabase);
    cleanup();
    return;
  }

  const wsUrl = `wss://socket.polygon.io/crypto`;
  
  console.log(`🔌 Creating new WebSocket connection (attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})...`);
  connectionState = ConnectionState.CONNECTING;
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('✅ WebSocket connected to Polygon');
    connectionState = ConnectionState.CONNECTED;
    reconnectAttempts = 0; // Reset on successful connection
    
    // Authenticate
    ws?.send(JSON.stringify({ action: 'auth', params: apiKey }));

    // Subscribe to tickers using polygon_ticker as-is (already includes X: prefix)
    const symbols = tickers.map(t => t.polygon_ticker);

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
          // Use msg.pair as-is (includes X: prefix like X:BTCUSD or X:HYPEUSD)
          const ticker = msg.pair || '';
          if (!ticker) continue;

          const price = msg.p || 0;
          const change = msg.d || 0; // Daily change percentage
          
          // Find the display name from our mappings
          const mapping = tickers.find(t => t.polygon_ticker === ticker);
          const display = mapping?.display_name || ticker;
          
          priceBuffer.set(ticker, {
            ticker,
            price,
            change24h: change,
            display,
            volume: msg.v,
          });
        }
        
        // Handle status messages
        if (msg.ev === 'status') {
          console.log('Status:', msg.message);
          
          // Reset failure counter on successful connection
          if (msg.message.includes('authenticated') || msg.message.includes('Connected Successfully')) {
            consecutiveFailures = 0;
          }
          
          // Monitor for connection limit warnings
          if (msg.message.includes('connection limit') || msg.message.includes('exceeded')) {
            console.error('🚨 CONNECTION LIMIT WARNING:', msg.message);
          }
        }
      }
    } catch (error) {
      console.error('Message parsing error:', error);
    }
  };

  ws.onerror = (error) => {
    console.error('❌ WebSocket error:', error);
    connectionState = ConnectionState.ERROR;
    consecutiveFailures++;
  };

  ws.onclose = async (event) => {
    console.log(`🔌 WebSocket closed (code: ${event.code}, reason: ${event.reason || 'none'})`);
    connectionState = ConnectionState.DISCONNECTED;
    
    // Enhanced monitoring for connection limit errors
    if (event.reason && event.reason.includes('connection limit')) {
      consecutiveFailures++;
      console.error(`🚨 CONNECTION LIMIT EXCEEDED (failure ${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES})`);
      console.log('💡 Suggestion: Check for other active Polygon.io WebSocket connections');
      console.log('💡 Backup polling should activate within 30 seconds');
      
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.error('❌ Too many consecutive connection limit failures. Backing off for 5 minutes.');
        await releaseLeadership(supabase);
        cleanup();
        return;
      }
    }
    
    // Attempt reconnect with exponential backoff if still leader
    if (isLeader && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      const backoffDelay = Math.min(5000 * Math.pow(2, reconnectAttempts - 1), 60000); // 5s, 10s, 20s, 40s, max 60s
      console.log(`🔄 Reconnecting in ${backoffDelay / 1000}s (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
      
      setTimeout(() => {
        if (isLeader) {
          startWebSocket(supabase, apiKey, tickers);
        }
      }, backoffDelay);
    } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('❌ Max reconnection attempts reached. Relay stopped.');
      console.log('🛡️ Backup price-poller function will take over');
      cleanup();
    }
  };
}

async function releaseLeadership(supabase: any) {
  try {
    await supabase
      .from('price_sync_leader')
      .delete()
      .eq('id', 'singleton')
      .eq('instance_id', LEADER_ID);
    console.log('✅ Leadership released');
  } catch (error) {
    console.error('Error releasing leadership:', error);
  }
}

function cleanup() {
  console.log('🧹 Cleaning up...');
  
  isLeader = false;
  
  if (ws && connectionState !== ConnectionState.DISCONNECTED) {
    console.log('🔌 Closing WebSocket connection...');
    connectionState = ConnectionState.CLOSING;
    try {
      ws.close();
    } catch (error) {
      console.error('Error during WebSocket cleanup:', error);
    }
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
  reconnectAttempts = 0;
  connectionState = ConnectionState.DISCONNECTED;
}

// Cleanup on shutdown - release leadership and close connections
addEventListener('beforeunload', async () => {
  console.log('⚠️ Function shutting down, releasing leadership...');
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (supabaseUrl && supabaseKey) {
    const supabase = createClient(supabaseUrl, supabaseKey);
    await releaseLeadership(supabase);
  }
  
  cleanup();
});
