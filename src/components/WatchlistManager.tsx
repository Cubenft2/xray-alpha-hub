import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, X, TrendingUp, ExternalLink } from 'lucide-react';
import { MiniChart } from './MiniChart';
import { useTickerMappings } from '@/hooks/useTickerMappings';

interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  type: 'crypto' | 'stock';
}

export function WatchlistManager() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [newSymbol, setNewSymbol] = useState('');
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { getMapping, isLoading } = useTickerMappings();

  useEffect(() => {
    const stored = localStorage.getItem('xr_watchlist');
    if (stored) {
      try {
        setWatchlist(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to load watchlist:', e);
      }
    }
  }, []);

  const saveWatchlist = (newWatchlist: WatchlistItem[]) => {
    setWatchlist(newWatchlist);
    localStorage.setItem('xr_watchlist', JSON.stringify(newWatchlist));
  };

  const addToWatchlist = () => {
    if (!newSymbol.trim()) return;
    
    const raw = newSymbol.toUpperCase().trim();
    const isExplicitExchange = raw.includes(':');

    let resolvedSymbol = raw;
    let itemType: 'crypto' | 'stock' = 'stock';
    let displayName = raw;

    if (isExplicitExchange) {
      // Explicit exchange prefix
      resolvedSymbol = raw;
      itemType = raw.startsWith('NASDAQ:') || raw.startsWith('NYSE:') || raw.startsWith('AMEX:') ? 'stock' : 'crypto';
      displayName = raw.split(':')[1] || raw;
    } else {
      // Check database mapping first
      const mapping = getMapping(raw);
      if (mapping) {
        resolvedSymbol = mapping.tradingview_symbol;
        itemType = mapping.type === 'stock' ? 'stock' : 'crypto';
        displayName = mapping.display_name || raw;
      } else {
        // Fallback heuristics for unmapped symbols
        const commonCryptos = ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'MATIC', 'DOT', 'AVAX', 'LINK'];
        
        if (commonCryptos.includes(raw)) {
          // Known crypto without mapping
          resolvedSymbol = `BINANCE:${raw}USDT`;
          itemType = 'crypto';
        } else if (/^[A-Z]{1,5}$/.test(raw)) {
          // Short symbol - default to stock (most stock tickers are 1-5 chars)
          resolvedSymbol = raw;
          itemType = 'stock';
        } else {
          // Unknown format - default to stock
          resolvedSymbol = raw;
          itemType = 'stock';
        }
      }
    }
    
    const newItem: WatchlistItem = {
      id: Date.now().toString(),
      symbol: resolvedSymbol,
      name: displayName,
      type: itemType
    };

    if (!watchlist.find(item => item.symbol === newItem.symbol)) {
      saveWatchlist([...watchlist, newItem]);
    }
    
    setNewSymbol('');
  };

  const removeFromWatchlist = (id: string) => {
    saveWatchlist(watchlist.filter(item => item.id !== id));
  };

  const clearWatchlist = () => {
    saveWatchlist([]);
  };

  const handleChartClick = (item: WatchlistItem) => {
    if (item.type === 'crypto') {
      navigate(`/crypto?symbol=${encodeURIComponent(item.symbol)}`);
    } else {
      navigate(`/markets?symbol=${encodeURIComponent(item.symbol)}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold xr-gradient-text">👀 Watchlist</h1>
        <p className="text-muted-foreground">Track your favorite crypto and stocks</p>
      </div>

      <Card className="xr-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Add New Symbol</span>
            {watchlist.length > 0 && (
              <Button variant="outline" size="sm" onClick={clearWatchlist}>
                Clear All
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-2">
            <Input
              placeholder="Enter symbol (e.g., BTC, AAPL, NASDAQ:TSLA)"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addToWatchlist()}
              className="flex-1"
            />
            <Button onClick={addToWatchlist} className="btn-hero">
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Crypto: BTC, ETH, SOL | Stocks: AAPL, NASDAQ:TSLA, NYSE:COIN
          </p>
        </CardContent>
      </Card>

      {watchlist.length === 0 ? (
        <Card className="xr-card">
          <CardContent className="text-center py-8">
            <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No items in watchlist</h3>
            <p className="text-muted-foreground">Add some symbols to start tracking</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {watchlist.map((item) => (
            <Card key={item.id} className="xr-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-semibold">{item.name}</h3>
                    <Badge variant={item.type === 'crypto' ? 'default' : 'secondary'}>
                      {item.type}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFromWatchlist(item.id)}
                    className="h-6 w-6 p-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative h-48 rounded-lg overflow-hidden group">
                  <MiniChart 
                    symbol={item.symbol} 
                    theme={theme} 
                    onClick={() => handleChartClick(item)}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <Button 
                      variant="secondary" 
                      size="sm"
                      onClick={() => handleChartClick(item)}
                      className="backdrop-blur-sm"
                    >
                      <ExternalLink className="w-4 h-4 mr-1" />
                      Open Chart
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}