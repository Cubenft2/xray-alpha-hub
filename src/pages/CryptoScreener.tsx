import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePolygonSnapshot, CryptoSnapshot } from '@/hooks/usePolygonSnapshot';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, ChevronRight } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';

type SortField = 'name' | 'price' | 'changePercent' | 'volume24h' | 'vwap' | 'high24h' | 'low24h' | 'market_cap' | 'market_cap_rank';
type SortDirection = 'asc' | 'desc';

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  if (price >= 0.0001) return `$${price.toFixed(6)}`;
  return `$${price.toFixed(8)}`;
}

function formatVolume(volume: number): string {
  if (volume >= 1e9) return `$${(volume / 1e9).toFixed(2)}B`;
  if (volume >= 1e6) return `$${(volume / 1e6).toFixed(2)}M`;
  if (volume >= 1e3) return `$${(volume / 1e3).toFixed(2)}K`;
  return `$${volume.toFixed(2)}`;
}

function formatMarketCap(cap: number | null): string {
  if (!cap) return '—';
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}B`;
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(2)}M`;
  return `$${cap.toLocaleString()}`;
}

function formatChange(change: number): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(2)}%`;
}

export default function CryptoScreener() {
  const navigate = useNavigate();
  const { data, isLoading, isRefetching, refetch, dataUpdatedAt } = usePolygonSnapshot();
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('market_cap_rank');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      // Default to ascending for rank, descending for everything else
      setSortDirection(field === 'market_cap_rank' ? 'asc' : 'desc');
    }
  };

  const filteredData = useMemo(() => {
    if (!data) return [];
    
    let result = data.filter(item => 
      item.symbol.toLowerCase().includes(search.toLowerCase()) ||
      item.name.toLowerCase().includes(search.toLowerCase())
    );

    result.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      // Handle null values for market cap fields - nulls go to end
      if (sortField === 'market_cap' || sortField === 'market_cap_rank') {
        if (aVal === null && bVal === null) return 0;
        if (aVal === null) return 1;
        if (bVal === null) return -1;
      }
      
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }
      
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });

    return result;
  }, [data, search, sortField, sortDirection]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-3 h-3 text-primary" />
      : <ArrowDown className="w-3 h-3 text-primary" />;
  };

  const lastUpdate = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : '--:--:--';

  return (
    <>
      <SEOHead 
        title="Crypto Screener | XRayCrypto™"
        description="Real-time cryptocurrency screener with live prices, market cap rankings, volume, and market data from Polygon.io"
      />
      
      <div className="min-h-screen bg-[#0a0a0a] text-foreground">
        <div className="container mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold">Crypto Screener</h1>
              <span className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full font-mono">
                {filteredData.length} matches
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or symbol..."
                  className="pl-9 w-64 bg-[#141414] border-[#2a2a2a] focus:border-primary"
                />
              </div>
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => refetch()}
                disabled={isRefetching}
                className="border-[#2a2a2a] hover:bg-[#1a1a1a]"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              
              <span className="text-xs text-muted-foreground font-mono">
                Updated: {lastUpdate}
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-lg border border-[#2a2a2a] overflow-hidden bg-[#0f0f0f]">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#141414] sticky top-0 z-10">
                  <tr className="text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="px-3 py-3 text-center w-14">
                      <button onClick={() => handleSort('market_cap_rank')} className="flex items-center gap-1 mx-auto hover:text-foreground">
                        # <SortIcon field="market_cap_rank" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left min-w-[180px]">
                      <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-foreground">
                        Name <SortIcon field="name" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <button onClick={() => handleSort('price')} className="flex items-center gap-1 ml-auto hover:text-foreground">
                        Price <SortIcon field="price" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <button onClick={() => handleSort('changePercent')} className="flex items-center gap-1 ml-auto hover:text-foreground">
                        24h % <SortIcon field="changePercent" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <button onClick={() => handleSort('market_cap')} className="flex items-center gap-1 ml-auto hover:text-foreground">
                        Market Cap <SortIcon field="market_cap" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <button onClick={() => handleSort('volume24h')} className="flex items-center gap-1 ml-auto hover:text-foreground">
                        Volume <SortIcon field="volume24h" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <button onClick={() => handleSort('vwap')} className="flex items-center gap-1 ml-auto hover:text-foreground">
                        VWAP <SortIcon field="vwap" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">High / Low</th>
                    <th className="px-2 py-3 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    // Loading skeletons
                    Array.from({ length: 20 }).map((_, i) => (
                      <tr key={i} className="border-t border-[#1a1a1a]">
                        <td className="px-3 py-3 text-center"><Skeleton className="h-4 w-6 mx-auto" /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-8 w-8 rounded-full" />
                            <div>
                              <Skeleton className="h-4 w-24 mb-1" />
                              <Skeleton className="h-3 w-12" />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-20 ml-auto" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-16 ml-auto" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-20 ml-auto" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-20 ml-auto" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-16 ml-auto" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-28 ml-auto" /></td>
                        <td className="px-2 py-3"></td>
                      </tr>
                    ))
                  ) : filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                        No cryptocurrencies found matching "{search}"
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((item) => (
                      <tr 
                        key={item.ticker} 
                        className="border-t border-[#1a1a1a] hover:bg-[#141414] transition-colors cursor-pointer group"
                        onClick={() => navigate(`/crypto-universe/${item.symbol}`)}
                      >
                        <td className="px-3 py-3 text-center text-muted-foreground font-mono text-sm">
                          {item.market_cap_rank ? `#${item.market_cap_rank}` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {item.logo_url ? (
                              <img 
                                src={item.logo_url} 
                                alt={item.name}
                                className="w-8 h-8 rounded-full"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                                {item.symbol.slice(0, 2)}
                              </div>
                            )}
                            <div>
                              <div className="font-medium text-sm">{item.name}</div>
                              <div className="text-xs text-muted-foreground">{item.symbol}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm">
                          {formatPrice(item.price)}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono text-sm ${
                          item.changePercent >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {formatChange(item.changePercent)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-muted-foreground">
                          {formatMarketCap(item.market_cap)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-muted-foreground">
                          {formatVolume(item.volume24h)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-muted-foreground">
                          {formatPrice(item.vwap)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                          <span className="text-green-500/70">{formatPrice(item.high24h)}</span>
                          {' / '}
                          <span className="text-red-500/70">{formatPrice(item.low24h)}</span>
                        </td>
                        <td className="px-2 py-3 text-muted-foreground">
                          <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer info */}
          <div className="mt-4 text-center text-xs text-muted-foreground">
            Prices from Polygon.io • Market cap from CoinGecko • Auto-refreshes every 30 seconds
          </div>
        </div>
      </div>
    </>
  );
}
