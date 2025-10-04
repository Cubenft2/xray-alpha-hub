import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const POLYGON_API_KEY = Deno.env.get('POLYGON_API_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// CORS headers for browser access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Leader election
const INSTANCE_ID = crypto.randomUUID();
let isLeader = false;
let isInitialized = false;

interface TickerConfig {
  symbol: string;
  display: string;
}

interface PriceData {
  ticker: string;
  display: string;
  price: number;
  change24h: number;
}

// Price state
const priceState = new Map<string, PriceData>();
let lastDatabaseWrite = 0;
const DATABASE_WRITE_INTERVAL = 250;

// Polygon WebSocket connection (single connection for all cryptos)
let cryptoWs: WebSocket | null = null;

// Reconnection state
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
let reconnectTimer: number | null = null;

// Ticker configuration
let tickerConfig: TickerConfig[] = [];

// ============================================
// LEADER ELECTION
// ============================================

async function tryBecomeLeader(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('price_sync_leader')
      .upsert({
        id: 'singleton',
        instance_id: INSTANCE_ID,
        heartbeat_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      });

    if (error) {
      console.error('❌ Leader election error:', error);
      return false;
    }

    // Check if we're the current leader
    const { data: current } = await supabase
      .from('price_sync_leader')
      .select('instance_id')
      .eq('id', 'singleton')
      .single();

    const amLeader = current?.instance_id === INSTANCE_ID;
    
    if (amLeader) {
      console.log(`✅ Elected as leader: ${INSTANCE_ID}`);
    } else {
      console.log(`⏸️ Standby mode (leader: ${current?.instance_id})`);
    }
    
    return amLeader;
  } catch (error) {
    console.error('❌ Leader election failed:', error);
    return false;
  }
}

async function sendHeartbeat() {
  if (!isLeader) return;
  
  try {
    await supabase
      .from('price_sync_leader')
      .update({ heartbeat_at: new Date().toISOString() })
      .eq('instance_id', INSTANCE_ID);
  } catch (error) {
    console.error('❌ Heartbeat failed:', error);
  }
}

async function checkLeaderHealth(): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('price_sync_leader')
      .select('heartbeat_at')
      .eq('id', 'singleton')
      .single();

    if (!data) return true;

    const heartbeatAge = Date.now() - new Date(data.heartbeat_at).getTime();
    const isStale = heartbeatAge > 30000;

    if (isStale) {
      console.log(`⚠️ Leader heartbeat stale (${heartbeatAge}ms), attempting takeover`);
      return true;
    }

    return false;
  } catch (error) {
    console.error('❌ Health check failed:', error);
    return true;
  }
}

// ============================================
// DATABASE FUNCTIONS
// ============================================

async function updatePriceInDB(priceData: PriceData) {
  try {
    await supabase
      .from('live_prices')
      .upsert({
        ticker: priceData.ticker,
        display: priceData.display,
        price: priceData.price,
        change24h: priceData.change24h,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'ticker'
      });
  } catch (error) {
    console.error('❌ Database write failed:', error);
  }
}

function throttledDatabaseUpdate(priceData: PriceData) {
  if (!isLeader) return;
  
  const now = Date.now();
  const existing = priceState.get(priceData.ticker);
  
  // Skip if price changed less than 0.01%
  if (existing && Math.abs((priceData.price - existing.price) / existing.price) < 0.0001) {
    return;
  }
  
  priceState.set(priceData.ticker, priceData);
  
  // Throttle database writes
  if (now - lastDatabaseWrite < DATABASE_WRITE_INTERVAL) {
    return;
  }
  
  lastDatabaseWrite = now;
  updatePriceInDB(priceData);
}

// ============================================
// LOAD TICKER CONFIGURATION FROM SETTINGS
// ============================================

async function loadTickerConfig(): Promise<TickerConfig[]> {
  try {
    console.log('📥 Loading ticker configuration from site_settings...');
    
    const { data: settings, error } = await supabase
      .from('site_settings')
      .select('setting_value')
      .eq('setting_key', 'ticker_list')
      .single();
    
    if (error || !settings) {
      console.warn('⚠️ Failed to load ticker config, using fallback:', error);
      return [
        { symbol: 'X:BTCUSD', display: 'BTC' },
        { symbol: 'X:ETHUSD', display: 'ETH' },
        { symbol: 'X:SOLUSD', display: 'SOL' }
      ];
    }
    
    const cryptoTickers = (settings.setting_value as any).crypto || [];
    const tickers = cryptoTickers.map((symbol: string) => ({
      symbol,
      display: symbol.replace('X:', '').replace('USD', '')
    }));
    
    console.log(`✅ Loaded ${tickers.length} crypto tickers from site_settings`);
    return tickers;
  } catch (err) {
    console.error('❌ Error loading ticker config:', err);
    return [];
  }
}

// ============================================
// FETCH INITIAL 24HR PRICES FROM POLYGON REST API
// ============================================

async function fetchInitialPrices(tickers: TickerConfig[]) {
  console.log(`🔄 Fetching initial prices for ${tickers.length} tickers...`);
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];
  
  // Batch process to avoid rate limits
  const batchSize = 10;
  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (ticker) => {
      try {
        const endpoint = `https://api.polygon.io/v2/aggs/ticker/${ticker.symbol}/range/1/day/${dateStr}/${dateStr}?apiKey=${POLYGON_API_KEY}`;
        
        const response = await fetch(endpoint);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
          const result = data.results[0];
          const change = ((result.c - result.o) / result.o) * 100;
          
          const priceData = {
            ticker: ticker.symbol,
            display: ticker.display,
            price: result.c,
            change24h: change
          };
          
          priceState.set(ticker.symbol, priceData);
          await updatePriceInDB(priceData);
          
          console.log(`✅ ${ticker.display}: $${result.c.toFixed(2)} (${change.toFixed(2)}%)`);
        }
      } catch (err) {
        console.error(`❌ Failed to fetch initial price for ${ticker.symbol}:`, err);
      }
    }));
    
    // Small delay between batches
    if (i + batchSize < tickers.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  console.log(`✅ Initial price fetch completed (${priceState.size} prices loaded)`);
}

// ============================================
// WEBSOCKET CONNECTION (SINGLE CONNECTION FOR ALL CRYPTOS)
// ============================================

function connectPolygonWebSocket(tickers: string[]) {
  const wsUrl = 'wss://socket.polygon.io/crypto';
  
  console.log(`🔌 Connecting to Polygon WebSocket with ${tickers.length} crypto tickers...`);
  
  cryptoWs = new WebSocket(wsUrl);
  
  cryptoWs.onopen = () => {
    console.log(`✅ Crypto WebSocket connected`);
    reconnectAttempts = 0;
    
    // Authenticate
    cryptoWs?.send(JSON.stringify({ action: 'auth', params: POLYGON_API_KEY }));
    
    // Subscribe to all crypto tickers in batches (Polygon has limits per subscription message)
    const BATCH_SIZE = 50;
    for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
      const batch = tickers.slice(i, i + BATCH_SIZE);
      const subscriptionParams = batch.map(t => `XA.${t}`).join(',');
      
      console.log(`📡 Subscribing to batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} tickers)...`);
      cryptoWs?.send(JSON.stringify({
        action: 'subscribe',
        params: subscriptionParams
      }));
    }
    
    console.log(`✅ Subscribed to ${tickers.length} crypto pairs`);
  };
  
  cryptoWs.onmessage = (event) => {
    try {
      const messages = JSON.parse(event.data);
      
      if (!Array.isArray(messages)) return;
      
      messages.forEach((msg: any) => {
        if (msg.ev === 'XA') { // Aggregate message for crypto
          const symbol = msg.pair;
          const price = msg.c;
          
          const config = tickerConfig.find(t => t.symbol === symbol);
          if (!config) return;
          
          // Calculate 24h change from stored state
          const existing = priceState.get(symbol);
          const change24h = existing?.change24h || 0;
          
          throttledDatabaseUpdate({
            ticker: symbol,
            display: config.display,
            price,
            change24h
          });
        } else if (msg.ev === 'status') {
          console.log(`📊 WebSocket status:`, msg.message);
        }
      });
    } catch (err) {
      console.error('❌ Error processing WebSocket message:', err);
    }
  };
  
  cryptoWs.onerror = (error) => {
    console.error('❌ Crypto WebSocket error:', error);
  };
  
  cryptoWs.onclose = () => {
    console.log('🔌 Crypto WebSocket closed');
    cryptoWs = null;
    
    // Implement exponential backoff
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
      reconnectAttempts++;
      
      console.log(`📡 Reconnecting in ${delay / 1000}s (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
      
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        connectPolygonWebSocket(tickers);
      }, delay);
    } else {
      console.error('❌ Max reconnection attempts reached');
    }
  };
}

// ============================================
// INITIALIZE POLYGON CONNECTIONS
// ============================================

async function initializePolygonConnections() {
  try {
    tickerConfig = await loadTickerConfig();
    if (tickerConfig.length === 0) {
      console.error('❌ No tickers to stream');
      return;
    }
    
    console.log(`🚀 Initializing Polygon stream for ${tickerConfig.length} crypto tickers`);
    
    // Fetch initial 24hr prices
    await fetchInitialPrices(tickerConfig);
    
    // Connect single WebSocket for all crypto tickers
    const tickerSymbols = tickerConfig.map(t => t.symbol);
    connectPolygonWebSocket(tickerSymbols);
    
    console.log(`✅ Polygon streaming initialized for ${tickerConfig.length} tickers`);
  } catch (err) {
    console.error('❌ Failed to initialize Polygon connections:', err);
  }
}

// ============================================
// INITIALIZATION
// ============================================

async function initialize() {
  console.log(`🆔 Instance ID: ${INSTANCE_ID}`);
  
  isLeader = await tryBecomeLeader();
  
  if (!isLeader) {
    console.log('⏸️ Standby mode - checking leader health every 30s');
    
    setInterval(async () => {
      const shouldRetry = await checkLeaderHealth();
      if (shouldRetry) {
        const becameLeader = await tryBecomeLeader();
        if (becameLeader) {
          isLeader = true;
          console.log('🎉 Promoted to leader!');
          await initializePolygonConnections();
        }
      }
    }, 30000);
    
    return;
  }
  
  await initializePolygonConnections();
  
  // Start heartbeat
  setInterval(() => sendHeartbeat(), 10000);
}

// ============================================
// DENO SERVER
// ============================================

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize only once per container lifecycle
  if (!isInitialized) {
    isInitialized = true;
    initialize(); // Don't await - let it run in background
  }
  
  return new Response(JSON.stringify({
    status: 'streaming',
    instance_id: INSTANCE_ID,
    is_leader: isLeader,
    tickers_configured: tickerConfig.length,
    prices_loaded: priceState.size,
    websocket_connected: cryptoWs?.readyState === WebSocket.OPEN,
    reconnect_attempts: reconnectAttempts
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});