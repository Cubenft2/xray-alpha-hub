import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Copy, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PolygonPreviewData {
  timestamp: string;
  crypto: {
    total: number;
    byQuoteCurrency: Record<string, number>;
    quoteExamples: Record<string, string[]>;
    uniqueBaseSymbols: number;
    multiPairAssets: Array<{
      symbol: string;
      pairCount: number;
      pairs: Array<{
        ticker: string;
        price?: number;
        volume?: number;
        updated?: number;
      }>;
    }>;
    btcPairs: Array<{
      ticker: string;
      price?: number;
      volume?: number;
      quote: string;
    }>;
    ethPairs: Array<{
      ticker: string;
      price?: number;
      volume?: number;
      quote: string;
    }>;
    sampleRawTicker: any;
  };
  forex: {
    total: number;
    samplePairs: any[];
  };
  stocks: {
    total: number;
    sampleTickers: any[];
  };
  rawCryptoResponse: any;
}

export function PolygonRawPreview() {
  const [data, setData] = useState<PolygonPreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data: response, error: fnError } = await supabase.functions.invoke('polygon-raw-preview');
      
      if (fnError) throw fnError;
      if (response.error) throw new Error(response.error);
      
      setData(response);
      toast.success('Data fetched successfully');
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message);
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (content: any, label: string) => {
    navigator.clipboard.writeText(JSON.stringify(content, null, 2));
    toast.success(`${label} copied to clipboard`);
  };

  const formatNumber = (num: number) => num?.toLocaleString() ?? 'N/A';
  const formatPrice = (price?: number) => price ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}` : 'N/A';
  const formatVolume = (vol?: number) => vol ? `$${(vol / 1e6).toFixed(2)}M` : 'N/A';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Polygon Raw Preview</h2>
          <p className="text-muted-foreground">Inspect raw data from Polygon unified snapshot endpoints</p>
        </div>
        <Button onClick={fetchData} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Fetching...' : 'Fetch Data'}
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {!data && !loading && !error && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Click "Fetch Data" to load raw Polygon API responses
            </p>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {data && (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Crypto Tickers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{formatNumber(data.crypto.total)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.crypto.uniqueBaseSymbols} unique assets
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={data.crypto.total > 624 ? "default" : "destructive"}>
                    {data.crypto.total > 624 ? (
                      <><CheckCircle2 className="h-3 w-3 mr-1" /> More than poly_tickers (624)</>
                    ) : (
                      <><AlertCircle className="h-3 w-3 mr-1" /> Less than expected</>
                    )}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Forex Pairs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{formatNumber(data.forex.total)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  From unified snapshot
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Stock Tickers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{formatNumber(data.stocks.total)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  US market stocks
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Quote Currency Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Crypto by Quote Currency</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3">Quote Currency</th>
                      <th className="text-right py-2 px-3">Count</th>
                      <th className="text-right py-2 px-3">% of Total</th>
                      <th className="text-left py-2 px-3">Example Tickers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.crypto.byQuoteCurrency)
                      .sort((a, b) => b[1] - a[1])
                      .map(([quote, count]) => (
                        <tr key={quote} className="border-b">
                          <td className="py-2 px-3 font-medium">{quote}</td>
                          <td className="text-right py-2 px-3">{formatNumber(count)}</td>
                          <td className="text-right py-2 px-3 text-muted-foreground">
                            {((count / data.crypto.total) * 100).toFixed(1)}%
                          </td>
                          <td className="py-2 px-3 text-muted-foreground text-xs">
                            {data.crypto.quoteExamples[quote]?.slice(0, 3).join(', ')}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* BTC Pairs */}
          <Card>
            <CardHeader>
              <CardTitle>BTC Trading Pairs ({data.crypto.btcPairs.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3">Ticker</th>
                      <th className="text-left py-2 px-3">Quote</th>
                      <th className="text-right py-2 px-3">Price</th>
                      <th className="text-right py-2 px-3">Volume 24h</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.crypto.btcPairs.map((pair) => (
                      <tr key={pair.ticker} className="border-b">
                        <td className="py-2 px-3 font-mono text-xs">{pair.ticker}</td>
                        <td className="py-2 px-3">
                          <Badge variant="outline">{pair.quote}</Badge>
                        </td>
                        <td className="text-right py-2 px-3">{formatPrice(pair.price)}</td>
                        <td className="text-right py-2 px-3">{formatVolume(pair.volume)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Multi-Pair Assets */}
          <Card>
            <CardHeader>
              <CardTitle>Assets with Multiple Trading Pairs (Top 20)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.crypto.multiPairAssets.slice(0, 10).map((asset) => (
                  <div key={asset.symbol} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold">{asset.symbol}</span>
                      <Badge>{asset.pairCount} pairs</Badge>
                    </div>
                    <div className="grid gap-2 text-xs">
                      {asset.pairs.slice(0, 5).map((pair, idx) => (
                        <div key={pair.ticker} className="flex items-center justify-between text-muted-foreground">
                          <span className="font-mono">{pair.ticker}</span>
                          <span>{formatPrice(pair.price)}</span>
                          <span>{formatVolume(pair.volume)}</span>
                          {idx === 0 && <Badge variant="secondary" className="text-[10px]">Primary (highest vol)</Badge>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Raw Sample Ticker */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Sample Raw Ticker (BTC/USD)</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRawJson(!showRawJson)}
                >
                  {showRawJson ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                  {showRawJson ? 'Hide' : 'Show'} JSON
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(data.crypto.sampleRawTicker, 'Sample ticker')}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </Button>
              </div>
            </CardHeader>
            {showRawJson && (
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                  {JSON.stringify(data.crypto.sampleRawTicker, null, 2)}
                </pre>
              </CardContent>
            )}
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Export Options</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => copyToClipboard(data.rawCryptoResponse, 'Full crypto response')}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Full Crypto Response
              </Button>
              <Button
                variant="outline"
                onClick={() => copyToClipboard(data, 'Full report')}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Full Report
              </Button>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground text-center">
            Last fetched: {new Date(data.timestamp).toLocaleString()}
          </p>
        </>
      )}
    </div>
  );
}
