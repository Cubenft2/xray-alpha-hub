// Context Manager: Session memory, recent assets/addresses extraction

export interface SessionContext {
  sessionId: string;
  recentAssets: string[];
  recentAddresses: { address: string; type: 'evm' | 'solana' }[];
  rollingSummary: string | null;
  messageCount: number;
}

const FILTER_WORDS = new Set([
  'THE', 'AND', 'FOR', 'NOT', 'YOU', 'ARE', 'BUT', 'HAS', 'HAD', 'WAS', 'HIS', 'HER',
  'CAN', 'NOW', 'HOW', 'WHY', 'WHO', 'ALL', 'GET', 'NEW', 'ONE', 'TWO', 'OUT', 'OUR', 'DAY', 'ANY',
  'IT', 'ITS', 'IS', 'BE', 'AM', 'IF', 'OR', 'AS', 'AT', 'BY', 'TO', 'OF', 'ON', 'IN', 'UP',
  'SO', 'GO', 'NO', 'AN', 'A', 'I', 'ME', 'MY', 'MINE', 'WE', 'US', 'THEY', 'THEM', 'THEIR',
  'DEX', 'CEX', 'API', 'USD', 'EUR', 'GBP', 'NFT', 'DAO', 'TVL', 'APY', 'APR', 'ATH', 'ATL',
  'THIS', 'THAT', 'WITH', 'FROM', 'YOUR', 'MAKE', 'POST', 'ABOUT', 'WHAT', 'SAFE', 'ADDRESS',
  'OK', 'OKAY', 'ALRIGHT', 'HEY', 'HELLO', 'HI', 'YES', 'YEAH', 'YEP', 'SURE', 'NAH', 'NOP',
  'NEED', 'GIVE', 'GAVE', 'LET', 'LETS', 'COPY', 'PASTE', 'TOKEN', 'TOKENS', 'COIN', 'COINS',
  'CRYPTO', 'PRICE', 'PRICES', 'DATA', 'INFO', 'CHART', 'COMPLETE', 'ANALYSIS', 'ANALYZE',
  'CHECK', 'LOOK', 'SHOW', 'TELL', 'FIND', 'SEARCH', 'SEE', 'WANT', 'WANTS', 'WOULD', 'COULD',
  'SHOULD', 'WILL', 'MIGHT', 'MUST', 'SHALL', 'MAY', 'HAVE', 'BEEN', 'BEING', 'WERE', 'SOME',
  'MANY', 'MUCH', 'MOST', 'MORE', 'LESS', 'FEW', 'JUST', 'ALSO', 'ONLY', 'EVEN', 'VERY',
  'REALLY', 'PLEASE', 'THANKS', 'THANK', 'THX', 'LIKE', 'GOOD', 'WELL', 'BEST', 'GREAT',
  'NICE', 'COOL', 'BAD', 'WORST', 'AWESOME', 'WHEN', 'WHERE', 'THEN', 'THAN', 'HERE', 'THERE',
  'WHICH', 'EACH', 'EVERY', 'BOTH', 'SAID', 'SAYS', 'SAY', 'ASK', 'ASKED', 'TELL', 'TOLD',
  'ASKING', 'MARKET', 'MARKETS', 'TRADE', 'TRADES', 'BUY', 'SELL', 'HOLD', 'LONG', 'SHORT',
  'HELP', 'HELPED', 'DO', 'DOES', 'DID', 'DONE', 'DOING', 'TRY', 'TRIED', 'THINK', 'KNOW',
  'FEEL', 'BELIEVE', 'STILL', 'YET', 'ALREADY', 'AGAIN', 'TOO', 'NEVER', 'ALWAYS', 'OFTEN',
]);

const TICKER_ALIASES: Record<string, string> = {
  'ETHE': 'ETH', 'ETHER': 'ETH', 'ETHEREUM': 'ETH', 'ETHERIUM': 'ETH',
  'BITC': 'BTC', 'BITCOIN': 'BTC', 'BITCOINS': 'BTC',
  'SOLA': 'SOL', 'SOLANA': 'SOL',
  'DOGECOIN': 'DOGE', 'DOGEE': 'DOGE',
  'CARDAN': 'ADA', 'CARDANO': 'ADA',
  'RIPPLE': 'XRP', 'RIPL': 'XRP',
  'CHAINLINK': 'LINK', 'CHAINLIN': 'LINK',
  'AVALANCH': 'AVAX', 'AVALANCHE': 'AVAX',
  'POLKADOT': 'DOT', 'POLKA': 'DOT',
  'POLYGON': 'MATIC', 'POLYG': 'MATIC',
  'LITECOIN': 'LTC', 'LITC': 'LTC',
  'UNISWAP': 'UNI', 'UNIS': 'UNI',
  'SHIBA': 'SHIB', 'SHIBAINU': 'SHIB',
  'COSM': 'ATOM', 'COSMOS': 'ATOM',
  'BINANCE': 'BNB', 'BINACE': 'BNB',
  'TETHER': 'USDT', 'STABLECOIN': 'USDT',
  'APPLE': 'AAPL', 'APPL': 'AAPL',
  'NVIDIA': 'NVDA', 'NVIDI': 'NVDA',
  'TESLA': 'TSLA', 'TESLE': 'TSLA',
  'MICROSOFT': 'MSFT', 'MICRO': 'MSFT',
  'GOOGLE': 'GOOGL', 'GOGLE': 'GOOGL', 'GOOG': 'GOOGL',
  'AMAZON': 'AMZN', 'AMAZN': 'AMZN',
  'COINBASE': 'COIN', 'COINBSE': 'COIN',
  'MICROSTRATEGY': 'MSTR', 'MICROSTR': 'MSTR',
};

export async function loadContext(
  supabase: any,
  sessionId: string,
  messages: { role: string; content: string }[]
): Promise<SessionContext> {
  // Extract recent assets and addresses from conversation
  const { assets, addresses } = extractFromMessages(messages);
  
  // Try to load from database
  let rollingSummary: string | null = null;
  let dbAssets: string[] = [];
  
  try {
    const { data: summary } = await supabase
      .from('chat_summaries')
      .select('rolling_summary, last_assets')
      .eq('session_id', sessionId)
      .maybeSingle();
    
    if (summary) {
      rollingSummary = summary.rolling_summary;
      dbAssets = summary.last_assets || [];
    }
  } catch (e) {
    console.warn('[Context] Failed to load from DB:', e);
  }
  
  // Merge DB assets with extracted assets (recent first)
  const mergedAssets = [...new Set([...assets, ...dbAssets])].slice(0, 10);
  
  return {
    sessionId,
    recentAssets: mergedAssets,
    recentAddresses: addresses,
    rollingSummary,
    messageCount: messages.length,
  };
}

function extractFromMessages(messages: { role: string; content: string }[]): {
  assets: string[];
  addresses: { address: string; type: 'evm' | 'solana' }[];
} {
  const recent = messages.slice(-10).reverse(); // Newest first
  const assets: string[] = [];
  const addresses: { address: string; type: 'evm' | 'solana' }[] = [];
  const seenAssets = new Set<string>();
  const seenAddresses = new Set<string>();
  
  const evmRe = /\b0x[a-fA-F0-9]{40}\b/g;
  const solRe = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
  
  for (const m of recent) {
    const content = String(m?.content ?? '');
    
    // Extract tickers
    const tickers = content.match(/\$?[A-Za-z]{2,10}\b/g) || [];
    for (const t of tickers) {
      const cleaned = t.replace('$', '').toUpperCase();
      const resolved = TICKER_ALIASES[cleaned] || cleaned;
      
      if (!FILTER_WORDS.has(resolved) && !seenAssets.has(resolved) && resolved.length >= 2 && resolved.length <= 10) {
        seenAssets.add(resolved);
        assets.push(resolved);
      }
    }
    
    // Extract EVM addresses
    const evmMatches = content.match(evmRe) || [];
    for (const a of evmMatches) {
      const normalized = a.toLowerCase();
      if (!seenAddresses.has(normalized)) {
        seenAddresses.add(normalized);
        addresses.push({ address: normalized, type: 'evm' });
      }
    }
    
    // Extract Solana addresses (with context check)
    const solMatches = content.match(solRe) || [];
    for (const a of solMatches) {
      const hasContext = /address|ca:|contract|token|mint/i.test(content);
      if (!seenAddresses.has(a) && hasContext && a.length >= 32) {
        seenAddresses.add(a);
        addresses.push({ address: a, type: 'solana' });
      }
    }
  }
  
  return { assets: assets.slice(0, 5), addresses: addresses.slice(0, 5) };
}

export async function saveMessage(
  supabase: any,
  sessionId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<void> {
  // Ensure session exists
  await supabase
    .from('chat_sessions')
    .upsert({
      session_id: sessionId,
      last_seen: new Date().toISOString(),
    }, { onConflict: 'session_id' });
  
  // Save message
  await supabase.from('chat_messages').insert({
    session_id: sessionId,
    role,
    content,
  });
}

export async function updateSessionAssets(
  supabase: any,
  sessionId: string,
  assets: string[]
): Promise<void> {
  await supabase
    .from('chat_summaries')
    .upsert({
      session_id: sessionId,
      last_assets: assets,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'session_id' });
}
