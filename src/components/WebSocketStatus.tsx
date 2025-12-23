import { useEffect, useState } from 'react';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, Activity, Clock, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkerHealth {
  status: string;
  cachedPrices: number;
  polygonConnected: boolean;
  messageCount: number;
  lastPriceAt: string | null;
  uptime: number;
}

export function WebSocketStatus() {
  const { isConnected, priceCount, isFallbackMode, messageCount, lastUpdateTime } = useWebSocket();
  const [workerHealth, setWorkerHealth] = useState<WorkerHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await fetch('https://crypto-stream.xrprat.workers.dev/health');
        if (response.ok) {
          const data = await response.json();
          setWorkerHealth(data);
        }
      } catch (err) {
        console.error('Failed to fetch worker health:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatTime = (timestamp: number | null): string => {
    if (!timestamp) return 'Never';
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return `${diff}s ago`;
    return `${Math.floor(diff / 60)}m ago`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5" />
          WebSocket Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Connection</span>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <>
                <Wifi className="h-4 w-4 text-success" />
                <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                  Connected
                </Badge>
              </>
            ) : isFallbackMode ? (
              <>
                <Database className="h-4 w-4 text-amber-500" />
                <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30">
                  REST Fallback
                </Badge>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-destructive" />
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                  Disconnected
                </Badge>
              </>
            )}
          </div>
        </div>

        {/* Prices Streaming */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Prices Streaming</span>
          <span className="font-mono text-sm">{priceCount}</span>
        </div>

        {/* Messages Received */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Messages Received</span>
          <span className="font-mono text-sm">{messageCount.toLocaleString()}</span>
        </div>

        {/* Last Update */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Last Update</span>
          <span className="font-mono text-sm flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatTime(lastUpdateTime)}
          </span>
        </div>

        {/* Worker Health Section */}
        {workerHealth && (
          <>
            <div className="border-t pt-3 mt-3">
              <h4 className="text-sm font-medium mb-2">Cloudflare Worker</h4>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge 
                variant="outline" 
                className={cn(
                  workerHealth.status === 'healthy' 
                    ? 'bg-success/10 text-success border-success/30'
                    : 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                )}
              >
                {workerHealth.status}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Polygon Connected</span>
              <span className={cn(
                'font-mono text-sm',
                workerHealth.polygonConnected ? 'text-success' : 'text-destructive'
              )}>
                {workerHealth.polygonConnected ? 'Yes' : 'No'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Cached Prices</span>
              <span className="font-mono text-sm">{workerHealth.cachedPrices}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Worker Messages</span>
              <span className="font-mono text-sm">{workerHealth.messageCount.toLocaleString()}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Uptime</span>
              <span className="font-mono text-sm">{formatUptime(workerHealth.uptime)}</span>
            </div>
          </>
        )}

        {loading && (
          <div className="text-sm text-muted-foreground text-center py-2">
            Loading worker health...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
