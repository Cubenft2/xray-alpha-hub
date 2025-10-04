import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const POLYGON_API_KEY = Deno.env.get('POLYGON_API_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Leader election
const INSTANCE_ID = crypto.randomUUID();
let isLeader = false;
let isInitialized = false;

interface TickerConfig {
  ticker: string;
  display: string;
  type: 'crypto' | 'fx';
  precision: number;
  enabled: boolean;
  position: number;
}

interface PriceData {
  ticker: string;
  display: string;
  price: number;
  change24h: number;
  timestamp: number;
}

interface PolygonAggregate {
  ev: string;
  pair: string;
  c: number;
  o: number;
  h: number;
  l: number;
  v: number;
  s: number;
}

// Price state
const priceState = new Map<string, PriceData>();
let lastDatabaseWrite = 0;
const DATABASE_WRITE_INTERVAL = 250;

// Polygon WebSocket connections
let cryptoWs: WebSocket | null = null;
let forexWs: WebSocket | null = null;

// Reconnection state
let reconnectAttempts = 0;
const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000];

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
        updated_at: new Date(priceData.timestamp).toISOString()
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
  
  if (existing && Math.abs((priceData.price - existing.price) / existing.price) < 0.0001) {
    return;
  }
  
  priceState.set(priceData.ticker, priceData);
  
  if (now - lastDatabaseWrite < DATABASE_WRITE_INTERVAL) {
    return;
  }
  
  lastDatabaseWrite = now;
  updatePriceInDB(priceData);
}

// Load ticker configuration from database
async function loadTickerConfig(): Promise<TickerConfig[]> {
  console.log('Loading ticker configuration from database...');
  const { data, error } = await supabase
    .from('site_settings')
    .select('setting_value')
    .eq('setting_key', 'ticker_list')
    .single();

  if (error) {
    console.error('Error loading ticker config:', error);
    return [];
  }

  const tickers = (data?.setting_value as TickerConfig[]) || [];
  const enabledTickers = tickers.filter(t => t.enabled);
  console.log(`Loaded ${enabledTickers.length} enabled tickers:`, enabledTickers.map(t => t.ticker));
  return enabledTickers;
}

// Fetch initial 24h prices from Polygon REST API
async function fetchInitialPrices(tickers: TickerConfig[]): Promise<void> {
  console.log('Fetching initial prices via REST...');
  
  for (const ticker of tickers) {
    try {
      if (ticker.type === 'crypto') {
        const symbol = ticker.ticker.replace('X:', '').replace('USD', '-USD');
        const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?adjusted=true&apiKey=${POLYGON_API_KEY}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.results?.[0]) {
          const result = data.results[0];
          const prevClose = result.c;
          const currentPrice = result.c;
          const change24h = prevClose > 0 ? ((currentPrice - prevClose) / prevClose) * 100 : 0;
          
          const priceData = {
            ticker: ticker.ticker,
            display: ticker.display,
            price: currentPrice,
            change24h,
            timestamp: Date.now()
          };
          
          priceState.set(ticker.ticker, priceData);
          await updatePriceInDB(priceData);
        }
      } else if (ticker.type === 'fx') {
        const pair = ticker.ticker.replace('C:', '');
        const from = pair.slice(0, 3);
        const to = pair.slice(3, 6);
        const url = `https://api.polygon.io/v1/last/currencies/${from}/${to}?apiKey=${POLYGON_API_KEY}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.last?.bid) {
          const priceData = {
            ticker: ticker.ticker,
            display: ticker.display,
            price: data.last.bid,
            change24h: 0,
            timestamp: Date.now()
          };
          
          priceState.set(ticker.ticker, priceData);
          await updatePriceInDB(priceData);
        }
      }
    } catch (error) {
      console.error(`Error fetching initial price for ${ticker.ticker}:`, error);
    }
  }
  
  console.log(`Initialized ${priceState.size} prices`);
}

// Connect to Polygon WebSocket
async function connectPolygonWebSocket(type: 'crypto' | 'fx', tickers: string[]) {
  if (tickers.length === 0) return;
  
  const wsUrl = type === 'crypto' 
    ? 'wss://socket.polygon.io/crypto'
    : 'wss://socket.polygon.io/forex';
  
  console.log(`Connecting to Polygon ${type} WebSocket...`);
  const ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    console.log(`Polygon ${type} WebSocket connected`);
    reconnectAttempts = 0;
    
    ws.send(JSON.stringify({
      action: 'auth',
      params: POLYGON_API_KEY
    }));
    
    const subscriptionParams = tickers.map(t => `XA.${t}`).join(',');
    ws.send(JSON.stringify({
      action: 'subscribe',
      params: subscriptionParams
    }));
    
    console.log(`Subscribed to ${type} tickers:`, subscriptionParams);
  };
  
  ws.onmessage = (event) => {
    try {
      const messages = JSON.parse(event.data);
      
      if (!Array.isArray(messages)) return;
      
      for (const msg of messages) {
        if (msg.ev === 'XA') {
          const agg = msg as PolygonAggregate;
          const ticker = agg.pair;
          
          const config = tickerConfig.find(t => t.ticker === ticker);
          if (!config) continue;
          
          const existing = priceState.get(ticker);
          const change24h = existing?.change24h || 0;
          
          throttledDatabaseUpdate({
            ticker,
            display: config.display,
            price: agg.c,
            change24h,
            timestamp: agg.s
          });
        }
        
        if (msg.ev === 'status') {
          console.log(`Polygon ${type} status:`, msg.message);
        }
      }
    } catch (error) {
      console.error(`Error processing ${type} message:`, error);
    }
  };
  
  ws.onerror = (error) => {
    console.error(`Polygon ${type} WebSocket error:`, error);
  };
  
  ws.onclose = () => {
    console.log(`Polygon ${type} WebSocket closed`);
    
    if (type === 'crypto') {
      cryptoWs = null;
    } else {
      forexWs = null;
    }
    
    const delay = RECONNECT_DELAYS[Math.min(reconnectAttempts, RECONNECT_DELAYS.length - 1)];
    reconnectAttempts++;
    
    console.log(`Reconnecting ${type} in ${delay}ms (attempt ${reconnectAttempts})...`);
    
    setTimeout(() => {
      connectPolygonWebSocket(type, tickers);
    }, delay);
  };
  
  if (type === 'crypto') {
    cryptoWs = ws;
  } else {
    forexWs = ws;
  }
}

// Initialize Polygon connections
async function initializePolygonConnections() {
  if (!isLeader) {
    console.log('⏸️ Not leader, skipping Polygon connection');
    return;
  }

  tickerConfig = await loadTickerConfig();
  
  if (tickerConfig.length === 0) {
    console.log('No enabled tickers found');
    return;
  }
  
  await fetchInitialPrices(tickerConfig);
  
  const cryptoTickers = tickerConfig
    .filter(t => t.type === 'crypto')
    .map(t => t.ticker);
  
  const forexTickers = tickerConfig
    .filter(t => t.type === 'fx')
    .map(t => t.ticker);
  
  if (cryptoTickers.length > 0) {
    await connectPolygonWebSocket('crypto', cryptoTickers);
  }
  
  if (forexTickers.length > 0) {
    await connectPolygonWebSocket('fx', forexTickers);
  }
  
  // Start heartbeat
  setInterval(() => sendHeartbeat(), 10000);
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
}

// ============================================
// DENO SERVER
// ============================================

Deno.serve(async (req) => {
  // Initialize only once per container lifecycle
  if (!isInitialized) {
    isInitialized = true;
    initialize(); // Don't await - let it run in background
  }
  
  return new Response(JSON.stringify({
    status: 'ok',
    instance_id: INSTANCE_ID,
    is_leader: isLeader,
    initialized: isInitialized,
    tickers: tickerConfig.length,
    prices: priceState.size,
    connections: {
      crypto: cryptoWs?.readyState === WebSocket.OPEN,
      forex: forexWs?.readyState === WebSocket.OPEN
    }
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
