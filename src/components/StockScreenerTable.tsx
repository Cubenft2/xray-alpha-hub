import { useNavigate } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ChevronUp, ChevronDown, TrendingUp, TrendingDown } from 'lucide-react';
import { StockCard, SortKey, SortDirection, getSimplifiedSector } from '@/hooks/useStockCards';

interface StockScreenerTableProps {
  stocks: StockCard[];
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
  isLoading: boolean;
}

function formatNumber(num: number | null, options?: { prefix?: string; suffix?: string; decimals?: number }): string {
  if (num === null || num === undefined) return 'N/A';
  const { prefix = '', suffix = '', decimals = 2 } = options ?? {};
  
  if (Math.abs(num) >= 1e12) return `${prefix}${(num / 1e12).toFixed(decimals)}T${suffix}`;
  if (Math.abs(num) >= 1e9) return `${prefix}${(num / 1e9).toFixed(decimals)}B${suffix}`;
  if (Math.abs(num) >= 1e6) return `${prefix}${(num / 1e6).toFixed(decimals)}M${suffix}`;
  if (Math.abs(num) >= 1e3) return `${prefix}${(num / 1e3).toFixed(decimals)}K${suffix}`;
  return `${prefix}${num.toFixed(decimals)}${suffix}`;
}

function formatPrice(price: number | null): string {
  if (price === null) return 'N/A';
  if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(4)}`;
}

// Brand colors for popular stocks
const BRAND_COLORS: Record<string, string> = {
  // Tech Giants
  'NVDA': 'bg-[#76B900]',    // Nvidia green
  'AAPL': 'bg-[#555555]',    // Apple dark gray
  'MSFT': 'bg-[#00A4EF]',    // Microsoft blue
  'GOOGL': 'bg-[#4285F4]',   // Google blue
  'GOOG': 'bg-[#4285F4]',    // Google blue
  'AMZN': 'bg-[#FF9900]',    // Amazon orange
  'META': 'bg-[#0866FF]',    // Meta blue
  'TSLA': 'bg-[#CC0000]',    // Tesla red
  'NFLX': 'bg-[#E50914]',    // Netflix red
  'AMD': 'bg-[#ED1C24]',     // AMD red
  'INTC': 'bg-[#0071C5]',    // Intel blue
  'CRM': 'bg-[#00A1E0]',     // Salesforce blue
  'ORCL': 'bg-[#C74634]',    // Oracle red
  'IBM': 'bg-[#0530AD]',     // IBM blue
  'CSCO': 'bg-[#049FD9]',    // Cisco blue
  'ADBE': 'bg-[#FF0000]',    // Adobe red
  'AVGO': 'bg-[#CC092F]',    // Broadcom red
  'QCOM': 'bg-[#3253DC]',    // Qualcomm blue
  'TXN': 'bg-[#CC0000]',     // Texas Instruments red
  'NOW': 'bg-[#81B5A1]',     // ServiceNow green
  'SNOW': 'bg-[#29B5E8]',    // Snowflake blue
  'PLTR': 'bg-[#101010]',    // Palantir black
  'UBER': 'bg-[#000000]',    // Uber black
  'LYFT': 'bg-[#FF00BF]',    // Lyft pink
  'SQ': 'bg-[#006AFF]',      // Block/Square blue
  'PYPL': 'bg-[#003087]',    // PayPal blue
  'SHOP': 'bg-[#96BF48]',    // Shopify green
  'SPOT': 'bg-[#1DB954]',    // Spotify green
  'ZM': 'bg-[#2D8CFF]',      // Zoom blue
  'DOCU': 'bg-[#FFCC22]',    // DocuSign yellow
  
  // Finance
  'JPM': 'bg-[#117ACA]',     // JPMorgan blue
  'V': 'bg-[#1A1F71]',       // Visa dark blue
  'MA': 'bg-[#EB001B]',      // Mastercard red
  'BAC': 'bg-[#012169]',     // Bank of America blue
  'GS': 'bg-[#7399C6]',      // Goldman Sachs blue
  'MS': 'bg-[#002D62]',      // Morgan Stanley blue
  'WFC': 'bg-[#D71E28]',     // Wells Fargo red
  'C': 'bg-[#003B70]',       // Citigroup blue
  'AXP': 'bg-[#006FCF]',     // AmEx blue
  'BLK': 'bg-[#000000]',     // BlackRock black
  'SCHW': 'bg-[#00A3E0]',    // Schwab blue
  'COF': 'bg-[#004977]',     // Capital One blue
  
  // Consumer
  'KO': 'bg-[#F40009]',      // Coca-Cola red
  'PEP': 'bg-[#004B93]',     // Pepsi blue
  'MCD': 'bg-[#FFC72C]',     // McDonald's gold
  'SBUX': 'bg-[#00704A]',    // Starbucks green
  'NKE': 'bg-[#111111]',     // Nike black
  'DIS': 'bg-[#113CCF]',     // Disney blue
  'HD': 'bg-[#F96302]',      // Home Depot orange
  'LOW': 'bg-[#004990]',     // Lowe's blue
  'TGT': 'bg-[#CC0000]',     // Target red
  'WMT': 'bg-[#0071CE]',     // Walmart blue
  'COST': 'bg-[#E31837]',    // Costco red
  'PG': 'bg-[#003DA5]',      // P&G blue
  'JNJ': 'bg-[#D51900]',     // J&J red
  'KHC': 'bg-[#1D428A]',     // Kraft Heinz blue
  'MDLZ': 'bg-[#5F259F]',    // Mondelez purple
  'CMG': 'bg-[#A81612]',     // Chipotle red
  'YUM': 'bg-[#E4002B]',     // Yum! red
  'DPZ': 'bg-[#006491]',     // Domino's blue
  
  // Healthcare/Pharma
  'PFE': 'bg-[#0093D0]',     // Pfizer blue
  'UNH': 'bg-[#002677]',     // UnitedHealth blue
  'ABBV': 'bg-[#071D49]',    // AbbVie blue
  'MRK': 'bg-[#00857C]',     // Merck teal
  'LLY': 'bg-[#D52B1E]',     // Eli Lilly red
  'BMY': 'bg-[#BE2BBB]',     // Bristol-Myers purple
  'AMGN': 'bg-[#0063BE]',    // Amgen blue
  'GILD': 'bg-[#C8102E]',    // Gilead red
  'CVS': 'bg-[#CC0000]',     // CVS red
  'WBA': 'bg-[#E31837]',     // Walgreens red
  
  // Energy
  'XOM': 'bg-[#ED1C24]',     // ExxonMobil red
  'CVX': 'bg-[#0066B2]',     // Chevron blue
  'COP': 'bg-[#CC0000]',     // ConocoPhillips red
  'SLB': 'bg-[#0066B2]',     // Schlumberger blue
  'OXY': 'bg-[#CF202E]',     // Occidental red
  
  // Crypto-related
  'COIN': 'bg-[#0052FF]',    // Coinbase blue
  'MSTR': 'bg-[#CC2027]',    // MicroStrategy red
  'HOOD': 'bg-[#00C805]',    // Robinhood green
  'MARA': 'bg-[#F7931A]',    // Marathon orange (Bitcoin)
  'RIOT': 'bg-[#004C97]',    // Riot blue
  
  // Aerospace/Defense
  'BA': 'bg-[#0033A0]',      // Boeing blue
  'LMT': 'bg-[#002F6C]',     // Lockheed Martin blue
  'RTX': 'bg-[#00205B]',     // RTX blue
  'NOC': 'bg-[#003E7E]',     // Northrop blue
  'GD': 'bg-[#003366]',      // General Dynamics blue
  
  // Automotive
  'F': 'bg-[#003478]',       // Ford blue
  'GM': 'bg-[#0170CE]',      // GM blue
  'TM': 'bg-[#EB0A1E]',      // Toyota red
  'RIVN': 'bg-[#F68B1F]',    // Rivian orange
  'LCID': 'bg-[#0033A1]',    // Lucid blue
  
  // Telecom/Media
  'T': 'bg-[#00A8E0]',       // AT&T blue
  'VZ': 'bg-[#CD040B]',      // Verizon red
  'TMUS': 'bg-[#E20074]',    // T-Mobile magenta
  'CMCSA': 'bg-[#FF0066]',   // Comcast red
  'CHTR': 'bg-[#0078C8]',    // Charter blue
  'WBD': 'bg-[#003087]',     // Warner Bros blue
  'PARA': 'bg-[#0064D2]',    // Paramount blue
};

// Generate consistent color based on symbol
function getSymbolColor(symbol: string): string {
  // Check brand color first
  if (BRAND_COLORS[symbol]) {
    return BRAND_COLORS[symbol];
  }
  // Fallback to hash-based color for unknown stocks
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 
    'bg-orange-500', 'bg-pink-500', 'bg-cyan-500',
    'bg-red-500', 'bg-amber-500', 'bg-indigo-500'
  ];
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// Stock Avatar component with initials
function StockAvatar({ symbol }: { symbol: string }) {
  const bgColor = getSymbolColor(symbol);
  const needsBorder = bgColor.includes('#000000') || bgColor.includes('#111111') || bgColor.includes('#101010');
  
  return (
    <div className={`w-6 h-6 rounded-full ${bgColor} flex items-center justify-center text-white text-xs font-bold shrink-0 ${needsBorder ? 'ring-1 ring-white/30' : ''}`}>
      {symbol.charAt(0)}
    </div>
  );
}

// RSI Bar component with color coding
function RSIBar({ rsi }: { rsi: number | null }) {
  if (rsi === null) return <span className="text-muted-foreground text-xs">N/A</span>;
  
  const getColor = () => {
    if (rsi < 30) return 'bg-green-500'; // Oversold
    if (rsi > 70) return 'bg-red-500';   // Overbought
    return 'bg-amber-500';               // Neutral
  };
  
  const getLabel = () => {
    if (rsi < 30) return 'Oversold';
    if (rsi > 70) return 'Overbought';
    return 'Neutral';
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full ${getColor()} transition-all`}
          style={{ width: `${rsi}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground">{rsi.toFixed(0)} {getLabel()}</span>
    </div>
  );
}

// Technical Signal Badge
function TechnicalSignalBadge({ signal }: { signal: string | null }) {
  if (!signal) return <span className="text-muted-foreground text-xs">N/A</span>;
  
  const config: Record<string, { bg: string; text: string; label: string }> = {
    'strong_buy': { bg: 'bg-green-500/20', text: 'text-green-500', label: 'Strong Buy' },
    'buy': { bg: 'bg-green-400/20', text: 'text-green-400', label: 'Buy' },
    'neutral': { bg: 'bg-amber-500/20', text: 'text-amber-500', label: 'Neutral' },
    'sell': { bg: 'bg-red-400/20', text: 'text-red-400', label: 'Sell' },
    'strong_sell': { bg: 'bg-red-500/20', text: 'text-red-500', label: 'Strong Sell' },
  };
  
  const { bg, text, label } = config[signal] ?? { bg: 'bg-muted', text: 'text-muted-foreground', label: signal };
  
  return (
    <Badge variant="outline" className={`${bg} ${text} border-0 text-[10px] font-medium`}>
      {label}
    </Badge>
  );
}

// 52-Week Range Progress Bar
function FiftyTwoWeekRange({ price, high, low }: { price: number | null; high: number | null; low: number | null }) {
  if (price === null || high === null || low === null || high === low) {
    return <span className="text-muted-foreground text-xs">N/A</span>;
  }
  
  const percentage = ((price - low) / (high - low)) * 100;
  const isNearHigh = percentage >= 95;
  const isNearLow = percentage <= 5;
  
  return (
    <div className="flex flex-col gap-1 min-w-[100px]">
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>${low.toFixed(0)}</span>
        <span>${high.toFixed(0)}</span>
      </div>
      <div className="relative w-full h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={`absolute top-0 left-0 h-full rounded-full transition-all ${
            isNearHigh ? 'bg-green-500' : isNearLow ? 'bg-red-500' : 'bg-primary'
          }`}
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
        />
        <div 
          className="absolute top-0 h-full w-0.5 bg-foreground"
          style={{ left: `${Math.min(100, Math.max(0, percentage))}%` }}
        />
      </div>
    </div>
  );
}

// Sortable Header
function SortableHeader({ 
  label, 
  sortKey: key, 
  currentSortKey, 
  sortDirection, 
  onSort,
  className = ''
}: { 
  label: string; 
  sortKey: SortKey; 
  currentSortKey: SortKey; 
  sortDirection: SortDirection; 
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const isActive = currentSortKey === key;
  
  return (
    <TableHead 
      className={`cursor-pointer hover:bg-muted/50 transition-colors ${className}`}
      onClick={() => onSort(key)}
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        {isActive && (
          sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        )}
      </div>
    </TableHead>
  );
}

export function StockScreenerTable({ stocks, sortKey, sortDirection, onSort, isLoading }: StockScreenerTableProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="w-full rounded-md border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow className="bg-card">
              <TableHead className="w-12 text-center">#</TableHead>
              <TableHead className="min-w-[180px]">Stock</TableHead>
              <SortableHeader label="Price" sortKey="price_usd" currentSortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
              <SortableHeader label="24h %" sortKey="change_pct" currentSortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
              <SortableHeader label="Market Cap" sortKey="market_cap" currentSortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
              <SortableHeader label="Volume" sortKey="volume" currentSortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
              <SortableHeader label="P/E" sortKey="pe_ratio" currentSortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
              <SortableHeader label="Div Yield" sortKey="dividend_yield" currentSortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
              <SortableHeader label="RSI-14" sortKey="rsi_14" currentSortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
              <TableHead>Signal</TableHead>
              <TableHead className="min-w-[120px]">52W Range</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stocks.map((stock, index) => {
              const isPositive = (stock.change_pct ?? 0) >= 0;
              const simplifiedSector = getSimplifiedSector(stock.sector);
              
              return (
                <TableRow 
                  key={stock.symbol}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/stock/${stock.symbol}`)}
                >
                  <TableCell className="text-center text-muted-foreground text-sm">
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <StockAvatar symbol={stock.symbol} />
                      <div>
                        <div className="font-medium text-sm">{stock.symbol}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                          {stock.name}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {formatPrice(stock.price_usd)}
                  </TableCell>
                  <TableCell>
                    <div className={`flex items-center gap-1 font-medium text-sm ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                      {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {stock.change_pct !== null ? `${isPositive ? '+' : ''}${stock.change_pct.toFixed(2)}%` : 'N/A'}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatNumber(stock.market_cap, { prefix: '$', decimals: 1 })}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatNumber(stock.volume, { decimals: 1 })}
                  </TableCell>
                  <TableCell className="text-sm">
                    {stock.pe_ratio !== null ? stock.pe_ratio.toFixed(1) : 'N/A'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {stock.dividend_yield !== null ? `${stock.dividend_yield.toFixed(2)}%` : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <RSIBar rsi={stock.rsi_14} />
                  </TableCell>
                  <TableCell>
                    <TechnicalSignalBadge signal={stock.technical_signal} />
                  </TableCell>
                  <TableCell>
                    <FiftyTwoWeekRange 
                      price={stock.price_usd} 
                      high={stock.high_52w} 
                      low={stock.low_52w} 
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
