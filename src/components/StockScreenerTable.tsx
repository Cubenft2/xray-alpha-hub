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

// Get logo URL with Clearbit fallback
function getLogoUrl(stock: StockCard): string | null {
  // Try Polygon logo first (but these require API key, so skip)
  // Use Clearbit which is free and doesn't require auth
  if (stock.website) {
    try {
      const url = new URL(stock.website.startsWith('http') ? stock.website : `https://${stock.website}`);
      const domain = url.hostname.replace('www.', '');
      return `https://logo.clearbit.com/${domain}`;
    } catch {
      return null;
    }
  }
  return null;
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
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
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
                      <img 
                        src={getLogoUrl(stock) || '/placeholder.svg'} 
                        alt={stock.symbol}
                        className="w-6 h-6 rounded-full object-cover bg-muted"
                        onError={(e) => {
                          e.currentTarget.src = '/placeholder.svg';
                          e.currentTarget.onerror = null;
                        }}
                      />
                      <div>
                        <div className="font-medium text-sm">{stock.symbol}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                          {stock.name}
                        </div>
                        {simplifiedSector !== 'Other' && (
                          <Badge variant="outline" className="text-[9px] mt-0.5 border-muted-foreground/30">
                            {simplifiedSector}
                          </Badge>
                        )}
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
