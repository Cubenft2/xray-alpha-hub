// Context Manager: Session memory, recent assets/addresses extraction
// FIX #2: Added lastResolvedAsset for proper follow-up binding

export interface SessionContext {
  sessionId: string;
  recentAssets: string[];
  recentAddresses: { address: string; type: 'evm' | 'solana' }[];
  rollingSummary: string | null;
  lastResolvedAsset: string | null;
  messageCount: number;
}

// Comprehensive stopwords - shared with resolver
const STOPWORDS = new Set([
  // Pronouns / possessives
  'I', 'ME', 'MY', 'MINE', 'YOU', 'YOUR', 'YOURS', 'WE', 'US', 'OUR', 'OURS',
  'THEY', 'THEM', 'THEIR', 'THEIRS', 'IT', 'ITS', 'HE', 'HIM', 'HIS', 'SHE', 'HER', 'HERS',
  
  // Common verbs / helpers
  'IS', 'ARE', 'WAS', 'WERE', 'BE', 'BEEN', 'BEING', 'AM',
  'DO', 'DOES', 'DID', 'DONE', 'DOING',
  'HAS', 'HAD', 'HAVE', 'HAVING',
  'CAN', 'COULD', 'SHOULD', 'WOULD', 'WILL', 'WONT', 'DONT', 'NOT',
  'YES', 'NO', 'YEAH', 'NAH', 'YEP', 'NOPE', 'OK', 'OKAY',
  
  // Question words
  'WHAT', 'WHY', 'HOW', 'WHEN', 'WHERE', 'WHO', 'WHOM', 'WHICH',
  
  // Articles / prepositions / conjunctions
  'A', 'AN', 'THE', 'AND', 'OR', 'BUT', 'IF', 'THEN', 'ELSE',
  'WITH', 'WITHOUT', 'OF', 'FOR', 'TO', 'FROM', 'IN', 'ON', 'AT', 'BY',
  
  // Chat/task words
  'WRITE', 'MAKE', 'CREATE', 'POST', 'TWEET', 'THREAD', 'CAPTION',
  'ANALYZE', 'ANALYSIS', 'CHECK', 'SAFE', 'SAFETY', 'NEWS',
  'PRICE', 'CHART', 'TRENDING', 'SENTIMENT', 'TODAY', 'NOW',
  'PLEASE', 'HELP', 'GIVE', 'GAVE', 'LET', 'LETS', 'TELL', 'TOLD',
  'SHOW', 'FIND', 'SEARCH', 'LOOK', 'SEE', 'WANT', 'NEED', 'ASK',
  
  // Common crypto/finance words
  'CRYPTO', 'TOKEN', 'TOKENS', 'COIN', 'COINS',
  'MARKET', 'MARKETS', 'VOLUME', 'MCAP', 'LIQUIDITY',
  'DEX', 'CEX', 'WALLET', 'ADDRESS', 'CONTRACT',
  'USD', 'EUR', 'GBP', 'NFT', 'DAO', 'TVL', 'APY', 'APR', 'ATH', 'ATL',
  'BUY', 'SELL', 'HOLD', 'TRADE', 'TRADES', 'LONG', 'SHORT',
  
  // Additional common words
  'THIS', 'THAT', 'THESE', 'THOSE', 'SUCH', 'OWN',
  'REAL', 'TRUE', 'FALSE', 'HIGH', 'LOW', 'BIG', 'SMALL', 'LARGE',
  'FIRST', 'LAST', 'SAME', 'OTHER', 'ANOTHER', 'NEXT',
  'BECAUSE', 'SINCE', 'AFTER', 'BEFORE', 'DURING', 'UNTIL', 'WHILE',
  'SOME', 'MANY', 'MUCH', 'MOST', 'MORE', 'LESS', 'FEW',
  'JUST', 'ALSO', 'ONLY', 'EVEN', 'VERY', 'REALLY', 'STILL', 'YET',
  'ALL', 'GET', 'NEW', 'ONE', 'TWO', 'OUT', 'DAY', 'ANY',
  'GOOD', 'WELL', 'BEST', 'GREAT', 'NICE', 'COOL', 'BAD', 'WORST',
  'ABOUT', 'SAID', 'SAYS', 'SAY', 'THINK', 'KNOW', 'FEEL', 'BELIEVE',
  'THANKS', 'THANK', 'THX', 'LIKE', 'AWESOME',
  'COPY', 'PASTE', 'DATA', 'INFO', 'COMPLETE',
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

// Check if token looks like a valid ticker (matching resolver logic)
function looksLikeTicker(token: string, hadDollar: boolean): boolean {
  if (hadDollar) return /^[A-Z0-9]{2,10}$/.test(token);
  if (!/^[A-Z0-9]{2,6}$/.test(token)) return false;
  if (STOPWORDS.has(token)) return false;
  if (token.length === 2 && ['IN', 'ON', 'AT', 'TO', 'OF', 'IT', 'IS', 'AS', 'OR', 'AN', 'UP', 'SO', 'GO', 'NO', 'IF', 'BY', 'BE', 'AM', 'WE', 'US', 'ME', 'MY', 'HE'].includes(token)) {
    return false;
  }
  return true;
}

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
  let lastResolvedAsset: string | null = null;
  
  try {
    const { data: summary } = await supabase
      .from('chat_summaries')
      .select('rolling_summary, last_assets, last_resolved_asset')
      .eq('session_id', sessionId)
      .maybeSingle();
    
    if (summary) {
      rollingSummary = summary.rolling_summary;
      dbAssets = summary.last_assets || [];
      lastResolvedAsset = summary.last_resolved_asset || null;
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
    lastResolvedAsset,
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
    
    // Extract tickers with improved filtering
    const tickers = content.match(/\$?[A-Za-z0-9]{2,10}\b/g) || [];
    for (const t of tickers) {
      const hadDollar = t.startsWith('$');
      const cleaned = t.replace('$', '').toUpperCase();
      const resolved = TICKER_ALIASES[cleaned] || cleaned;
      
      // Use proper validation
      if (!seenAssets.has(resolved) && looksLikeTicker(resolved, hadDollar)) {
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

// FIX #2: Update session with lastResolvedAsset for follow-up binding
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
      last_resolved_asset: assets[0] ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'session_id' });
}
