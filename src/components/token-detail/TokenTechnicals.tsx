import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface TokenTechnicalsProps {
  rsi14: number | null;
  rsiSignal: string | null;
  macdLine: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  macdTrend: string | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  ema12: number | null;
  ema26: number | null;
  priceUsd: number | null;
  technicalSignal: string | null;
  technicalScore: number | null;
  priceVsSma20: string | null;
  priceVsSma50: string | null;
  priceVsSma200: string | null;
  technicalsUpdatedAt: string | null;
}

export function TokenTechnicals({
  rsi14,
  rsiSignal,
  macdLine,
  macdSignal,
  macdHistogram,
  macdTrend,
  sma20,
  sma50,
  sma200,
  ema12,
  ema26,
  priceUsd,
  technicalSignal,
  technicalScore,
  priceVsSma20,
  priceVsSma50,
  priceVsSma200,
  technicalsUpdatedAt,
}: TokenTechnicalsProps) {
  const hasData = rsi14 !== null || macdLine !== null || sma20 !== null;

  if (!hasData) {
    return (
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Technical Indicators
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Technical data not available for this token
          </p>
        </CardContent>
      </Card>
    );
  }

  const getRsiColor = (rsi: number) => {
    if (rsi >= 70) return 'text-destructive';
    if (rsi <= 30) return 'text-green-500';
    return 'text-yellow-500';
  };

  const getRsiLabel = (rsi: number) => {
    if (rsi >= 70) return 'Overbought';
    if (rsi <= 30) return 'Oversold';
    return 'Neutral';
  };

  const getSignalBadge = (signal: string | null) => {
    if (!signal) return null;
    const variants: Record<string, { variant: 'default' | 'destructive' | 'secondary'; icon: React.ReactNode }> = {
      bullish: { variant: 'default', icon: <TrendingUp className="h-3 w-3" /> },
      bearish: { variant: 'destructive', icon: <TrendingDown className="h-3 w-3" /> },
      neutral: { variant: 'secondary', icon: <Minus className="h-3 w-3" /> },
    };
    const config = variants[signal.toLowerCase()] || variants.neutral;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        {config.icon}
        {signal}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Technical Indicators
          </CardTitle>
          {technicalSignal && getSignalBadge(technicalSignal)}
        </div>
        {technicalsUpdatedAt && (
          <p className="text-xs text-muted-foreground">
            Updated {new Date(technicalsUpdatedAt).toLocaleTimeString()}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* RSI */}
        {rsi14 !== null && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">RSI-14</span>
              <div className="flex items-center gap-2">
                <span className={`font-bold ${getRsiColor(rsi14)}`}>{rsi14.toFixed(1)}</span>
                <Badge variant="outline" className="text-xs">
                  {rsiSignal || getRsiLabel(rsi14)}
                </Badge>
              </div>
            </div>
            <div className="relative h-2 bg-muted rounded-full overflow-hidden">
              <div className="absolute inset-0 flex">
                <div className="w-[30%] bg-green-500/30" />
                <div className="w-[40%] bg-yellow-500/30" />
                <div className="w-[30%] bg-red-500/30" />
              </div>
              <div
                className="absolute top-0 h-full w-1 bg-foreground"
                style={{ left: `${Math.min(100, Math.max(0, rsi14))}%` }}
              />
            </div>
          </div>
        )}

        {/* MACD */}
        {macdLine !== null && (
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">MACD</span>
              {macdTrend && getSignalBadge(macdTrend)}
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-muted-foreground">Line</div>
                <div className="font-medium">{macdLine.toFixed(4)}</div>
              </div>
              {macdSignal !== null && (
                <div>
                  <div className="text-muted-foreground">Signal</div>
                  <div className="font-medium">{macdSignal.toFixed(4)}</div>
                </div>
              )}
              {macdHistogram !== null && (
                <div>
                  <div className="text-muted-foreground">Histogram</div>
                  <div className={`font-medium ${macdHistogram >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                    {macdHistogram.toFixed(4)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Moving Averages */}
        {(sma20 !== null || sma50 !== null || sma200 !== null) && (
          <div className="space-y-2 pt-2 border-t">
            <div className="text-sm text-muted-foreground">Moving Averages</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {sma20 !== null && (
                <div>
                  <div className="text-muted-foreground">SMA-20</div>
                  <div className="font-medium">${sma20.toFixed(2)}</div>
                  {priceVsSma20 && (
                    <div className={`text-xs ${priceVsSma20 === 'above' ? 'text-green-500' : 'text-destructive'}`}>
                      {priceVsSma20}
                    </div>
                  )}
                </div>
              )}
              {sma50 !== null && (
                <div>
                  <div className="text-muted-foreground">SMA-50</div>
                  <div className="font-medium">${sma50.toFixed(2)}</div>
                  {priceVsSma50 && (
                    <div className={`text-xs ${priceVsSma50 === 'above' ? 'text-green-500' : 'text-destructive'}`}>
                      {priceVsSma50}
                    </div>
                  )}
                </div>
              )}
              {sma200 !== null && (
                <div>
                  <div className="text-muted-foreground">SMA-200</div>
                  <div className="font-medium">${sma200.toFixed(2)}</div>
                  {priceVsSma200 && (
                    <div className={`text-xs ${priceVsSma200 === 'above' ? 'text-green-500' : 'text-destructive'}`}>
                      {priceVsSma200}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* EMA */}
        {(ema12 !== null || ema26 !== null) && (
          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t">
            {ema12 !== null && (
              <div>
                <div className="text-muted-foreground">EMA-12</div>
                <div className="font-medium">${ema12.toFixed(2)}</div>
              </div>
            )}
            {ema26 !== null && (
              <div>
                <div className="text-muted-foreground">EMA-26</div>
                <div className="font-medium">${ema26.toFixed(2)}</div>
              </div>
            )}
          </div>
        )}

        {/* Technical Score */}
        {technicalScore !== null && (
          <div className="pt-2 border-t">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Technical Score</span>
              <span className="font-bold">{technicalScore}/100</span>
            </div>
            <Progress value={technicalScore} className="mt-2" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
