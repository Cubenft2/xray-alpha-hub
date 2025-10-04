import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const POLYGON_API_KEY = Deno.env.get('POLYGON_API_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

// Connected browser clients
const clients = new Set<WebSocket>();

// Price state
const priceState = new Map<string, PriceData>();

// Last broadcast time for throttling
let lastBroadcast = 0;
const BROADCAST_INTERVAL = 250; // 4 updates per second

// Polygon WebSocket connections
let cryptoWs: WebSocket | null = null;
let forexWs: WebSocket | null = null;

// Reconnection state
let reconnectAttempts = 0;
const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000];

// Ticker configuration
let tickerConfig: TickerConfig[] = [];

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
        // Extract symbol (X:BTCUSD -> BTC-USD)
        const symbol = ticker.ticker.replace('X:', '').replace('USD', '-USD');
        const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?adjusted=true&apiKey=${POLYGON_API_KEY}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.results?.[0]) {
          const result = data.results[0];
          const prevClose = result.c;
          const currentPrice = result.c;
          const change24h = prevClose > 0 ? ((currentPrice - prevClose) / prevClose) * 100 : 0;
          
          priceState.set(ticker.ticker, {
            ticker: ticker.ticker,
            display: ticker.display,
            price: currentPrice,
            change24h,
            timestamp: Date.now()
          });
        }
      } else if (ticker.type === 'fx') {
        // Extract forex pair (C:EURUSD -> EUR/USD)
        const pair = ticker.ticker.replace('C:', '');
        const from = pair.slice(0, 3);
        const to = pair.slice(3, 6);
        const url = `https://api.polygon.io/v1/last/currencies/${from}/${to}?apiKey=${POLYGON_API_KEY}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.last?.bid) {
          priceState.set(ticker.ticker, {
            ticker: ticker.ticker,
            display: ticker.display,
            price: data.last.bid,
            change24h: 0,
            timestamp: Date.now()
          });
        }
      }
    } catch (error) {
      console.error(`Error fetching initial price for ${ticker.ticker}:`, error);
    }
  }
  
  console.log(`Initialized ${priceState.size} prices`);
}

// Broadcast to all connected clients
function broadcastToClients(message: any) {
  const messageStr = JSON.stringify(message);
  const deadClients: WebSocket[] = [];
  
  for (const client of clients) {
    try {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      } else {
        deadClients.push(client);
      }
    } catch (error) {
      console.error('Error broadcasting to client:', error);
      deadClients.push(client);
    }
  }
  
  // Clean up dead connections
  for (const client of deadClients) {
    clients.delete(client);
  }
}

// Throttled price broadcast
function throttledBroadcast(priceData: PriceData) {
  const now = Date.now();
  
  // Update state immediately
  const existing = priceState.get(priceData.ticker);
  
  // Skip if price hasn't changed by at least 0.01%
  if (existing && Math.abs((priceData.price - existing.price) / existing.price) < 0.0001) {
    return;
  }
  
  priceState.set(priceData.ticker, priceData);
  
  // Throttle broadcasts
  if (now - lastBroadcast < BROADCAST_INTERVAL) {
    return;
  }
  
  lastBroadcast = now;
  
  broadcastToClients({
    type: 'price_update',
    data: priceData
  });
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
    
    // Authenticate
    ws.send(JSON.stringify({
      action: 'auth',
      params: POLYGON_API_KEY
    }));
    
    // Subscribe to second aggregates (XA.*)
    const subscriptionParams = tickers.map(t => `XA.${t}`).join(',');
    ws.send(JSON.stringify({
      action: 'subscribe',
      params: subscriptionParams
    }));
    
    console.log(`Subscribed to ${type} tickers:`, subscriptionParams);
    
    broadcastToClients({
      type: 'status',
      status: 'connected',
      message: `Connected to Polygon ${type} stream`
    });
  };
  
  ws.onmessage = (event) => {
    try {
      const messages = JSON.parse(event.data);
      
      if (!Array.isArray(messages)) return;
      
      for (const msg of messages) {
        // Handle aggregate bars (second-level)
        if (msg.ev === 'XA') {
          const agg = msg as PolygonAggregate;
          const ticker = agg.pair;
          
          // Find ticker config for display name
          const config = tickerConfig.find(t => t.ticker === ticker);
          if (!config) continue;
          
          // Calculate 24h change (use existing or 0)
          const existing = priceState.get(ticker);
          const change24h = existing?.change24h || 0;
          
          throttledBroadcast({
            ticker,
            display: config.display,
            price: agg.c,
            change24h,
            timestamp: agg.s
          });
        }
        
        // Handle status messages
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
    broadcastToClients({
      type: 'status',
      status: 'error',
      message: `Polygon ${type} connection error`
    });
  };
  
  ws.onclose = () => {
    console.log(`Polygon ${type} WebSocket closed`);
    
    if (type === 'crypto') {
      cryptoWs = null;
    } else {
      forexWs = null;
    }
    
    // Attempt reconnection with exponential backoff
    const delay = RECONNECT_DELAYS[Math.min(reconnectAttempts, RECONNECT_DELAYS.length - 1)];
    reconnectAttempts++;
    
    console.log(`Reconnecting ${type} in ${delay}ms (attempt ${reconnectAttempts})...`);
    
    broadcastToClients({
      type: 'status',
      status: 'reconnecting',
      message: `Reconnecting to Polygon ${type}... (${reconnectAttempts})`
    });
    
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
  tickerConfig = await loadTickerConfig();
  
  if (tickerConfig.length === 0) {
    console.log('No enabled tickers found');
    return;
  }
  
  // Fetch initial prices
  await fetchInitialPrices(tickerConfig);
  
  // Separate crypto and forex tickers
  const cryptoTickers = tickerConfig
    .filter(t => t.type === 'crypto')
    .map(t => t.ticker);
  
  const forexTickers = tickerConfig
    .filter(t => t.type === 'fx')
    .map(t => t.ticker);
  
  // Connect to appropriate WebSockets
  if (cryptoTickers.length > 0) {
    await connectPolygonWebSocket('crypto', cryptoTickers);
  }
  
  if (forexTickers.length > 0) {
    await connectPolygonWebSocket('fx', forexTickers);
  }
}

// Handle new client connection
function handleClientConnection(socket: WebSocket) {
  console.log('New client connected');
  clients.add(socket);
  
  // Send initial snapshot
  const snapshot = Array.from(priceState.values());
  socket.send(JSON.stringify({
    type: 'snapshot',
    data: snapshot
  }));
  
  // Send current status
  const hasConnections = (cryptoWs?.readyState === WebSocket.OPEN) || 
                        (forexWs?.readyState === WebSocket.OPEN);
  
  socket.send(JSON.stringify({
    type: 'status',
    status: hasConnections ? 'connected' : 'connecting',
    message: hasConnections ? 'Connected to Polygon' : 'Connecting to Polygon...'
  }));
  
  socket.onclose = () => {
    console.log('Client disconnected');
    clients.delete(socket);
  };
  
  socket.onerror = (error) => {
    console.error('Client connection error:', error);
    clients.delete(socket);
  };
  
  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      
      // Handle ping
      if (msg.type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (error) {
      console.error('Error handling client message:', error);
    }
  };
}

// Main handler
Deno.serve(async (req) => {
  const upgrade = req.headers.get('upgrade') || '';
  
  // Handle WebSocket upgrade
  if (upgrade.toLowerCase() === 'websocket') {
    const { socket, response } = Deno.upgradeWebSocket(req);
    handleClientConnection(socket);
    return response;
  }
  
  // HTTP endpoint for status
  return new Response(JSON.stringify({
    status: 'ok',
    clients: clients.size,
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

// Initialize on startup
initializePolygonConnections();
