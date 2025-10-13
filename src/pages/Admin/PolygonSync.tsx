import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Zap, Radio, StopCircle } from 'lucide-react';

export function PolygonSync() {
  const [mapping, setMapping] = useState(false);
  const [relaying, setRelaying] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleMapTickers = async () => {
    setMapping(true);
    try {
      const { data, error } = await supabase.functions.invoke('map-polygon-tickers');
      
      if (error) throw error;
      
      toast.success('Polygon tickers mapped successfully', {
        description: `Mapped: ${data.mapped}, Skipped: ${data.skipped}, Not Found: ${data.notFound}`
      });
    } catch (error: any) {
      console.error('Error mapping tickers:', error);
      toast.error('Failed to map tickers', {
        description: error.message
      });
    } finally {
      setMapping(false);
    }
  };

  const handleStartRelay = async () => {
    setRelaying(true);
    try {
      const { data, error } = await supabase.functions.invoke('polygon-price-relay');
      
      if (error) throw error;
      
      toast.success('Price relay started', {
        description: data.message || 'WebSocket connection established'
      });
    } catch (error: any) {
      console.error('Error starting relay:', error);
      toast.error('Failed to start relay', {
        description: error.message
      });
    } finally {
      setRelaying(false);
    }
  };

  const handleStopRelay = async () => {
    setStopping(true);
    try {
      const { error } = await supabase
        .from('price_sync_leader')
        .delete()
        .eq('id', 'singleton');
      
      if (error) throw error;
      
      toast.success('Price relay stopped', {
        description: 'Leadership released. Wait 30 seconds for cleanup, then restart if needed.'
      });
    } catch (error: any) {
      console.error('Error stopping relay:', error);
      toast.error('Failed to stop relay', {
        description: error.message
      });
    } finally {
      setStopping(false);
    }
  };

  const handleSyncPrices = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('manual-price-sync');
      
      if (error) throw error;
      
      toast.success('Prices synced successfully', {
        description: `Synced ${data.synced} prices from Polygon (${data.sources.polygon}), CoinGecko (${data.sources.coingecko}), and Exchange (${data.sources.exchange})`
      });
    } catch (error: any) {
      console.error('Error syncing prices:', error);
      toast.error('Failed to sync prices', {
        description: error.message
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Sync Prices Now
          </CardTitle>
          <CardDescription>
            Manually sync current prices from Polygon.io and CoinGecko to populate live_prices table
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will fetch current prices for the top 100 cryptocurrencies and update the live_prices table.
            Uses Polygon.io as primary source, with CoinGecko and exchange data as fallbacks.
          </p>
          <div className="bg-muted/50 p-3 rounded-lg text-xs space-y-1">
            <p><strong>💡 Use this when:</strong></p>
            <p>• Brief generation is failing due to missing price data</p>
            <p>• The automated price relay is not running</p>
            <p>• You need fresh prices immediately</p>
          </div>
          <Button 
            onClick={handleSyncPrices} 
            disabled={syncing}
            className="w-full"
          >
            {syncing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {syncing ? 'Syncing Prices...' : 'Sync Prices Now'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Map Polygon Tickers
          </CardTitle>
          <CardDescription>
            Map the 71 target crypto symbols to Polygon.io ticker format (X:SYMBOLUSD)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will query the poly_tickers table and update ticker_mappings with the correct polygon_ticker values
            for all target cryptocurrencies (BTC, ETH, SOL, etc.).
          </p>
          <Button 
            onClick={handleMapTickers} 
            disabled={mapping}
            className="w-full"
          >
            {mapping && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mapping ? 'Mapping Tickers...' : 'Map Polygon Tickers'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            Price Relay Control
          </CardTitle>
          <CardDescription>
            Start or stop the centralized WebSocket connection to stream live prices
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will establish a single WebSocket connection to Polygon.io and subscribe to all mapped crypto tickers.
            Prices will be buffered and upserted to the live_prices table every second.
          </p>
          <div className="bg-muted/50 p-3 rounded-lg text-xs space-y-1">
            <p><strong>⚠️ Important:</strong> Run "Map Polygon Tickers" first!</p>
            <p>The relay will automatically subscribe to all tickers with polygon_ticker values in ticker_mappings.</p>
            <p><strong>🛑 If stuck:</strong> Use "Force Stop" to clear leadership and wait 30 seconds before restarting.</p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleStartRelay} 
              disabled={relaying || stopping}
              className="flex-1"
              variant="default"
            >
              {relaying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {relaying ? 'Starting...' : 'Start Relay'}
            </Button>
            <Button 
              onClick={handleStopRelay} 
              disabled={stopping || relaying}
              className="flex-1"
              variant="destructive"
            >
              {stopping && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <StopCircle className="mr-2 h-4 w-4" />
              {stopping ? 'Stopping...' : 'Force Stop'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
