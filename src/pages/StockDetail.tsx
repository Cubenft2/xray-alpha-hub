import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, TrendingUp, TrendingDown, ExternalLink, Building2, Users, Globe, Calendar } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { getSimplifiedSector } from '@/hooks/useStockCards';

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
  if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(4)}`;
}

// Metric Card Component
function MetricCard({ label, value, subValue }: { label: string; value: string; subValue?: string }) {
  return (
    <div className="bg-muted/30 rounded-lg p-3">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-lg font-bold">{value}</div>
      {subValue && <div className="text-xs text-muted-foreground">{subValue}</div>}
    </div>
  );
}

// Technical Signal Badge
function TechnicalSignalBadge({ signal }: { signal: string | null }) {
  if (!signal) return <Badge variant="outline">N/A</Badge>;
  
  const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    'strong_buy': { variant: 'default', label: 'Strong Buy' },
    'buy': { variant: 'default', label: 'Buy' },
    'neutral': { variant: 'secondary', label: 'Neutral' },
    'sell': { variant: 'destructive', label: 'Sell' },
    'strong_sell': { variant: 'destructive', label: 'Strong Sell' },
  };
  
  const { variant, label } = config[signal] ?? { variant: 'outline', label: signal };
  
  return <Badge variant={variant}>{label}</Badge>;
}

// RSI Gauge
function RSIGauge({ rsi }: { rsi: number | null }) {
  if (rsi === null) return <span className="text-muted-foreground">N/A</span>;
  
  const getColor = () => {
    if (rsi < 30) return 'text-green-500';
    if (rsi > 70) return 'text-red-500';
    return 'text-amber-500';
  };
  
  const getLabel = () => {
    if (rsi < 30) return 'Oversold';
    if (rsi > 70) return 'Overbought';
    return 'Neutral';
  };

  return (
    <div className="flex items-center gap-2">
      <span className={`text-2xl font-bold ${getColor()}`}>{rsi.toFixed(1)}</span>
      <Badge variant="outline" className={getColor()}>{getLabel()}</Badge>
    </div>
  );
}

export default function StockDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();

  const { data: stock, isLoading, error } = useQuery({
    queryKey: ['stock-detail', symbol],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_cards')
        .select('*')
        .eq('symbol', symbol?.toUpperCase())
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!symbol,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (error || !stock) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-muted-foreground mb-4">Stock not found</p>
            <Button onClick={() => navigate('/stocks')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Screener
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPositive = (stock.change_pct ?? 0) >= 0;
  const simplifiedSector = getSimplifiedSector(stock.sector);
  const news = Array.isArray(stock.top_news) ? stock.top_news : [];

  return (
    <>
      <SEOHead 
        title={`${stock.symbol} - ${stock.name} | XRayCrypto Stock`}
        description={`${stock.symbol} stock analysis: Price ${formatPrice(stock.price_usd)}, P/E ${stock.pe_ratio?.toFixed(1) ?? 'N/A'}, technical indicators, and fundamentals.`}
      />

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Back Button */}
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-center gap-4">
            {(stock.logo_url || stock.icon_url) && (
              <img 
                src={stock.logo_url || stock.icon_url || ''} 
                alt={stock.symbol}
                className="w-16 h-16 rounded-full object-cover"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-bold">{stock.symbol}</h1>
                {stock.exchange && (
                  <Badge variant="outline" className="text-xs">{stock.exchange}</Badge>
                )}
              </div>
              <p className="text-muted-foreground">{stock.name}</p>
              {simplifiedSector !== 'Other' && (
                <Badge variant="secondary" className="mt-1">{simplifiedSector}</Badge>
              )}
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-3xl font-bold">{formatPrice(stock.price_usd)}</div>
            <div className={`flex items-center justify-end gap-1 text-lg font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {isPositive ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
              {stock.change_pct !== null ? `${isPositive ? '+' : ''}${stock.change_pct.toFixed(2)}%` : 'N/A'}
            </div>
            <TechnicalSignalBadge signal={stock.technical_signal} />
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="technicals">Technicals</TabsTrigger>
            <TabsTrigger value="fundamentals">Fundamentals</TabsTrigger>
            <TabsTrigger value="news">News</TabsTrigger>
          </TabsList>

          {/* Summary Tab */}
          <TabsContent value="summary" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard label="Price" value={formatPrice(stock.price_usd)} />
              <MetricCard 
                label="24h Change" 
                value={stock.change_pct !== null ? `${stock.change_pct.toFixed(2)}%` : 'N/A'} 
              />
              <MetricCard label="Market Cap" value={formatNumber(stock.market_cap, { prefix: '$' })} />
              <MetricCard label="Volume" value={formatNumber(stock.volume)} />
              <MetricCard label="P/E Ratio" value={stock.pe_ratio?.toFixed(2) ?? 'N/A'} />
              <MetricCard label="EPS" value={stock.eps !== null ? `$${stock.eps.toFixed(2)}` : 'N/A'} />
              <MetricCard label="Dividend Yield" value={stock.dividend_yield !== null ? `${stock.dividend_yield.toFixed(2)}%` : 'N/A'} />
              <MetricCard label="RSI-14" value={stock.rsi_14?.toFixed(1) ?? 'N/A'} />
            </div>

            {/* 52-Week Range */}
            {stock.high_52w && stock.low_52w && (
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">52-Week Range</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between text-sm mb-2">
                    <span>${stock.low_52w.toFixed(2)}</span>
                    <span>${stock.high_52w.toFixed(2)}</span>
                  </div>
                  <div className="relative w-full h-3 bg-muted rounded-full overflow-hidden">
                    {stock.price_usd && (
                      <>
                        <div 
                          className="absolute top-0 left-0 h-full bg-primary/50 rounded-full"
                          style={{ 
                            width: `${((stock.price_usd - stock.low_52w) / (stock.high_52w - stock.low_52w)) * 100}%` 
                          }}
                        />
                        <div 
                          className="absolute top-0 h-full w-1 bg-primary"
                          style={{ 
                            left: `${((stock.price_usd - stock.low_52w) / (stock.high_52w - stock.low_52w)) * 100}%` 
                          }}
                        />
                      </>
                    )}
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>{stock.low_52w_date ? `Low: ${stock.low_52w_date}` : ''}</span>
                    <span>{stock.high_52w_date ? `High: ${stock.high_52w_date}` : ''}</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Technicals Tab */}
          <TabsContent value="technicals" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">RSI (14)</CardTitle>
                </CardHeader>
                <CardContent>
                  <RSIGauge rsi={stock.rsi_14} />
                  <p className="text-xs text-muted-foreground mt-2">
                    RSI below 30 indicates oversold conditions, above 70 indicates overbought.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">MACD</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">MACD Line</span>
                      <span className="font-medium">{stock.macd_line?.toFixed(4) ?? 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Signal Line</span>
                      <span className="font-medium">{stock.macd_signal?.toFixed(4) ?? 'N/A'}</span>
                    </div>
                    {stock.macd_line && stock.macd_signal && (
                      <Badge variant={stock.macd_line > stock.macd_signal ? 'default' : 'destructive'}>
                        {stock.macd_line > stock.macd_signal ? 'Bullish' : 'Bearish'}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Moving Averages</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground">SMA 20</div>
                      <div className="font-medium">{stock.sma_20 ? `$${stock.sma_20.toFixed(2)}` : 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">SMA 50</div>
                      <div className="font-medium">{stock.sma_50 ? `$${stock.sma_50.toFixed(2)}` : 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">SMA 200</div>
                      <div className="font-medium">{stock.sma_200 ? `$${stock.sma_200.toFixed(2)}` : 'N/A'}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Fundamentals Tab */}
          <TabsContent value="fundamentals" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Company Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sector</span>
                    <span>{stock.sector || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Industry</span>
                    <span className="text-right max-w-[200px] truncate">{stock.industry || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" /> Employees
                    </span>
                    <span>{stock.employees?.toLocaleString() ?? 'N/A'}</span>
                  </div>
                  {stock.website && (
                    <a 
                      href={stock.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline text-sm"
                    >
                      <Globe className="h-3 w-3" />
                      {stock.website.replace(/^https?:\/\//, '').split('/')[0]}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Valuation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">P/E Ratio</span>
                    <span className="font-medium">{stock.pe_ratio?.toFixed(2) ?? 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">EPS</span>
                    <span className="font-medium">{stock.eps !== null ? `$${stock.eps.toFixed(2)}` : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Market Cap</span>
                    <span className="font-medium">{formatNumber(stock.market_cap, { prefix: '$' })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dividend Yield</span>
                    <span className="font-medium">{stock.dividend_yield !== null ? `${stock.dividend_yield.toFixed(2)}%` : 'N/A'}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {stock.description && (
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">About</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {stock.description}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* News Tab */}
          <TabsContent value="news" className="space-y-4">
            {news.length > 0 ? (
              <div className="space-y-3">
                {news.map((article: any, index: number) => (
                  <Card key={index}>
                    <CardContent className="py-3">
                      <a 
                        href={article.url || article.article_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        <h3 className="font-medium text-sm">{article.title}</h3>
                      </a>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        {article.publisher?.name && <span>{article.publisher.name}</span>}
                        {article.published_utc && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(article.published_utc).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No news available for this stock
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
