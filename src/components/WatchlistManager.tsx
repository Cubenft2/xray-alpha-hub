import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, X, TrendingUp } from 'lucide-react';

interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  type: 'crypto' | 'stock';
}

export function WatchlistManager() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [newSymbol, setNewSymbol] = useState('');

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
    
    const symbol = newSymbol.toUpperCase().trim();
    const isStock = symbol.includes(':') || symbol.match(/^[A-Z]{1,5}$/);
    
    const newItem: WatchlistItem = {
      id: Date.now().toString(),
      symbol: isStock ? symbol : `BINANCE:${symbol}USDT`,
      name: symbol,
      type: isStock ? 'stock' : 'crypto'
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
                <div className="h-48 rounded-lg overflow-hidden">
                  <div
                    dangerouslySetInnerHTML={{
                      __html: `
                        <div class="tradingview-widget-container" style="height:100%;width:100%">
                          <div class="tradingview-widget-container__widget" style="height:calc(100% - 32px);width:100%"></div>
                          <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js" async>
                          {
                            "symbol": "${item.symbol}",
                            "width": "100%",
                            "height": "100%",
                            "locale": "en",
                            "dateRange": "12M",
                            "colorTheme": "${document.documentElement.classList.contains('dark') ? 'dark' : 'light'}",
                            "isTransparent": false,
                            "autosize": true,
                            "largeChartUrl": ""
                          }
                          </script>
                        </div>
                      `
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}