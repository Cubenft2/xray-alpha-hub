import { useState, useCallback } from 'react';
import { useWebSocketPrices, PriceUpdate } from '@/hooks/useWebSocketPrices';
import { LivePriceIndicator } from '@/components/LivePriceIndicator';
import { LivePrice } from '@/components/LivePrice';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Activity, Zap, Clock } from 'lucide-react';

export default function WebSocketTest() {
  const [symbols, setSymbols] = useState<string[]>(['BTC', 'ETH', 'SOL', 'XRP']);
  const [newSymbol, setNewSymbol] = useState('');
  const [logs, setLogs] = useState<string[]>([]);

  const handlePriceUpdate = useCallback((update: PriceUpdate) => {
    const logEntry = `[${new Date().toLocaleTimeString()}] ${update.symbol}: $${update.price.toLocaleString()}`;
    setLogs(prev => [logEntry, ...prev.slice(0, 99)]);
  }, []);

  const { 
    prices, 
    isConnected, 
    error, 
    messageCount, 
    lastUpdateTime 
  } = useWebSocketPrices({
    symbols,
    enabled: true,
    onPriceUpdate: handlePriceUpdate,
  });

  const addSymbol = () => {
    const sym = newSymbol.trim().toUpperCase();
    if (sym && !symbols.includes(sym)) {
      setSymbols(prev => [...prev, sym]);
      setNewSymbol('');
    }
  };

  const removeSymbol = (symbol: string) => {
    setSymbols(prev => prev.filter(s => s !== symbol));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addSymbol();
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">WebSocket Price Test</h1>
          <p className="text-muted-foreground">
            Real-time crypto prices via Cloudflare Worker
          </p>
        </div>
        <LivePriceIndicator isConnected={isConnected} />
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive rounded-lg p-3 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{messageCount}</p>
              <p className="text-xs text-muted-foreground">Messages</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-success/10 rounded-lg">
              <Activity className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{symbols.length}</p>
              <p className="text-xs text-muted-foreground">Subscriptions</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-warning/10 rounded-lg">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {lastUpdateTime ? new Date(lastUpdateTime).toLocaleTimeString() : '--'}
              </p>
              <p className="text-xs text-muted-foreground">Last Update</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Symbol Input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Subscriptions</CardTitle>
          <CardDescription>Add or remove symbols to subscribe</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter symbol (e.g., DOGE)"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              className="flex-1"
            />
            <Button onClick={addSymbol} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {symbols.map(symbol => (
              <Badge 
                key={symbol} 
                variant="secondary"
                className="flex items-center gap-1 pr-1"
              >
                {symbol}
                <button 
                  onClick={() => removeSymbol(symbol)}
                  className="ml-1 hover:bg-destructive/20 rounded p-0.5"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Live Prices */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Live Prices</CardTitle>
          <CardDescription>Real-time price updates with flash animations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {symbols.map(symbol => {
              const priceData = prices[symbol] || null;
              return (
                <div 
                  key={symbol}
                  className="p-4 bg-muted/30 rounded-lg border border-border"
                >
                  <div className="text-xs text-muted-foreground mb-1">{symbol}</div>
                  <LivePrice 
                    priceData={priceData} 
                    size="lg" 
                    showChange 
                  />
                  {priceData && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Vol: {priceData.volume?.toLocaleString() || '--'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Message Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Message Log</CardTitle>
          <CardDescription>Latest 100 price updates</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64">
            <div className="space-y-1 font-mono text-xs">
              {logs.length === 0 ? (
                <div className="text-muted-foreground text-center py-8">
                  Waiting for price updates...
                </div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="text-muted-foreground">
                    {log}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
