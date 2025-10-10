import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, AlertTriangle, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TradingViewChart } from '@/components/TradingViewChart';
import { useTickerMappings } from '@/hooks/useTickerMappings';

interface CoinDetail {
  id: number;
  name: string;
  symbol: string;
  price: number;
  price_btc: number;
  market_cap: number;
  percent_change_24h: number;
  percent_change_7d: number;
  percent_change_30d: number;
  volume_24h: number;
  max_supply: number | null;
  circulating_supply: number;
  galaxy_score: number;
  alt_rank: number;
  volatility: number;
  market_cap_rank: number;
}

interface CoinAnalysis {
  risk_level: string;
  trends: {
    short_term: string;
    medium_term: string;
    long_term: string;
  };
  volume_to_mcap_ratio: number;
  galaxy_score_interpretation: string;
}

export default function CryptoUniverseDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getMapping } = useTickerMappings();
  const [coin, setCoin] = useState<CoinDetail | null>(null);
  const [analysis, setAnalysis] = useState<CoinAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCoinDetail = async () => {
      if (!symbol) return;

      try {
        setLoading(true);
        const { data, error } = await supabase.functions.invoke(
          `lunarcrush-coin-detail?coin=${symbol}`
        );

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Failed to fetch coin detail');

        setCoin(data.data);
        setAnalysis(data.analysis);
      } catch (err: any) {
        console.error('Error fetching coin detail:', err);
        toast({
          title: 'Error',
          description: 'Failed to load coin details. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchCoinDetail();
  }, [symbol, toast]);

  const formatCurrency = (value: number) => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return `$${value.toFixed(2)}`;
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'LOW': return 'text-green-500';
      case 'MEDIUM': return 'text-yellow-500';
      case 'ELEVATED': return 'text-orange-500';
      case 'HIGH': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  const getTrendIcon = (trend: string) => {
    return trend === 'BULLISH' ? (
      <TrendingUp className="h-4 w-4 text-green-500" />
    ) : (
      <TrendingDown className="h-4 w-4 text-red-500" />
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: 'Token address copied to clipboard',
    });
  };

  const getExplorerUrl = (address: string, chain: string) => {
    const explorers: Record<string, string> = {
      ethereum: `https://etherscan.io/token/${address}`,
      bsc: `https://bscscan.com/token/${address}`,
      polygon: `https://polygonscan.com/token/${address}`,
      arbitrum: `https://arbiscan.io/token/${address}`,
      optimism: `https://optimistic.etherscan.io/token/${address}`,
      avalanche: `https://snowtrace.io/token/${address}`,
      base: `https://basescan.org/token/${address}`,
    };
    return explorers[chain.toLowerCase()] || null;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  if (!coin) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center space-y-4">
          <AlertTriangle className="h-12 w-12 mx-auto text-destructive" />
          <h2 className="text-2xl font-bold">Coin Not Found</h2>
          <Button onClick={() => navigate('/crypto-universe')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Universe
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/crypto-universe')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold">{coin.symbol}</h1>
            <span className="text-2xl text-muted-foreground">{coin.name}</span>
          </div>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-3xl font-bold">{formatCurrency(coin.price)}</span>
            <Badge
              variant={coin.percent_change_24h > 0 ? 'default' : 'destructive'}
              className="text-base"
            >
              {coin.percent_change_24h > 0 ? '+' : ''}
              {coin.percent_change_24h.toFixed(2)}% (24h)
            </Badge>
          </div>
        </div>
      </div>

      {/* TradingView Chart */}
      <Card>
        <CardContent className="p-0">
          <TradingViewChart 
            symbol={getMapping(coin.symbol)?.tradingview_symbol || `CRYPTO:${coin.symbol}USD`} 
            height="500px" 
          />
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Market Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Market Cap</span>
              <span className="font-semibold">{formatCurrency(coin.market_cap)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Volume 24h</span>
              <span className="font-semibold">{formatCurrency(coin.volume_24h)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Market Cap Rank</span>
              <span className="font-semibold">#{coin.market_cap_rank}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Circulating Supply</span>
              <span className="font-semibold">
                {coin.circulating_supply.toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">LunarCrush Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Galaxy Score</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">{coin.galaxy_score}</span>
                <Badge variant="outline">{analysis?.galaxy_score_interpretation}</Badge>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">AltRank</span>
              <span className="font-semibold">#{coin.alt_rank}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Volatility</span>
              <span className="font-semibold">{(coin.volatility * 100).toFixed(2)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Risk Level</span>
              <span className={`font-bold ${getRiskColor(analysis?.risk_level || 'MEDIUM')}`}>
                {analysis?.risk_level || 'N/A'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Trend Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Short-term (24h)</span>
              <div className="flex items-center gap-2">
                {getTrendIcon(analysis?.trends.short_term || 'BEARISH')}
                <span className="font-semibold">{coin.percent_change_24h.toFixed(2)}%</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Medium-term (7d)</span>
              <div className="flex items-center gap-2">
                {getTrendIcon(analysis?.trends.medium_term || 'BEARISH')}
                <span className="font-semibold">{coin.percent_change_7d.toFixed(2)}%</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Long-term (30d)</span>
              <div className="flex items-center gap-2">
                {getTrendIcon(analysis?.trends.long_term || 'BEARISH')}
                <span className="font-semibold">{coin.percent_change_30d.toFixed(2)}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Token Information - Only show if dex_address exists */}
        {getMapping(coin.symbol)?.dex_address && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Token Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <span className="text-muted-foreground text-sm">Blockchain</span>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="capitalize">
                    {getMapping(coin.symbol)?.dex_chain || 'Unknown'}
                  </Badge>
                </div>
              </div>
              
              <div>
                <span className="text-muted-foreground text-sm">Contract Address</span>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 px-3 py-2 bg-muted rounded text-xs font-mono break-all">
                    {getMapping(coin.symbol)?.dex_address}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(getMapping(coin.symbol)?.dex_address || '')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  {getMapping(coin.symbol)?.dex_chain && 
                   getExplorerUrl(getMapping(coin.symbol)?.dex_address || '', getMapping(coin.symbol)?.dex_chain || '') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const url = getExplorerUrl(
                          getMapping(coin.symbol)?.dex_address || '', 
                          getMapping(coin.symbol)?.dex_chain || ''
                        );
                        if (url) window.open(url, '_blank');
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
