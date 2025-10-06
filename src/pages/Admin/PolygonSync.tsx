import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Zap, Radio } from 'lucide-react';

export function PolygonSync() {
  const [mapping, setMapping] = useState(false);
  const [relaying, setRelaying] = useState(false);

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

  return (
    <div className="space-y-6">
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
            Start Price Relay
          </CardTitle>
          <CardDescription>
            Start the centralized WebSocket connection to stream live prices
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will establish a single WebSocket connection to Polygon.io and subscribe to all mapped crypto tickers.
            Prices will be buffered and upserted to the live_prices table every 5 seconds.
          </p>
          <div className="bg-muted/50 p-3 rounded-lg text-xs space-y-1">
            <p><strong>⚠️ Important:</strong> Run "Map Polygon Tickers" first!</p>
            <p>The relay will automatically subscribe to all tickers with polygon_ticker values in ticker_mappings.</p>
          </div>
          <Button 
            onClick={handleStartRelay} 
            disabled={relaying}
            className="w-full"
            variant="default"
          >
            {relaying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {relaying ? 'Starting Relay...' : 'Start Price Relay'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
