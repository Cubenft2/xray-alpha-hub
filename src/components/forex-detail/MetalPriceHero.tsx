import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface ForexCard {
  pair: string;
  rate: number | null;
  change_24h_pct: number | null;
  high_24h: number | null;
  low_24h: number | null;
  ath_price: number | null;
  ath_date: string | null;
  rsi_14: number | null;
  technical_signal: string | null;
}

interface MetalPriceHeroProps {
  forexData: ForexCard | null;
  isLoading: boolean;
  metal: 'silver' | 'gold' | 'platinum' | 'palladium';
}

const metalInfo: Record<string, { icon: string; name: string; gradientClass: string }> = {
  gold: { icon: '🥇', name: 'Gold', gradientClass: 'gold-price-gradient' },
  silver: { icon: '🥈', name: 'Silver', gradientClass: 'silver-price-gradient' },
  platinum: { icon: '⚪', name: 'Platinum', gradientClass: 'platinum-price-gradient' },
  palladium: { icon: '🔘', name: 'Palladium', gradientClass: 'palladium-price-gradient' }
};

export function MetalPriceHero({ forexData, isLoading, metal }: MetalPriceHeroProps) {
  const { icon, name, gradientClass } = metalInfo[metal] || metalInfo.gold;

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-4 mb-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div>
            <Skeleton className="h-6 w-24 mb-2" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
        <Skeleton className="h-16 w-48 mb-4" />
        <div className="flex gap-4">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-24" />
        </div>
      </Card>
    );
  }

  if (!forexData) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground">Price data unavailable</p>
      </Card>
    );
  }

  const change = forexData.change_24h_pct || 0;
  const isPositive = change >= 0;
  
  // Calculate distance from ATH
  const athDistance = forexData.ath_price && forexData.rate 
    ? ((forexData.rate - forexData.ath_price) / forexData.ath_price) * 100 
    : null;

  // RSI-based signal
  const getRsiSignal = () => {
    if (!forexData.rsi_14) return null;
    if (forexData.rsi_14 > 70) return { label: 'Overbought', color: 'destructive' as const };
    if (forexData.rsi_14 < 30) return { label: 'Oversold', color: 'default' as const };
    return { label: 'Neutral', color: 'secondary' as const };
  };
  const rsiSignal = getRsiSignal();

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <span className="text-5xl">{icon}</span>
          <div>
            <h2 className="text-2xl font-bold">{name}</h2>
            <p className="text-muted-foreground font-mono">{forexData.pair}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 items-end">
          {forexData.technical_signal && (
            <Badge variant="outline" className="text-xs">
              {forexData.technical_signal}
            </Badge>
          )}
          {rsiSignal && (
            <Badge variant={rsiSignal.color} className="text-xs">
              RSI: {forexData.rsi_14?.toFixed(0)} • {rsiSignal.label}
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className={`text-5xl font-bold font-mono ${gradientClass}`}>
          ${forexData.rate?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className={`flex items-center gap-2 ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {isPositive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            <span className="font-mono font-bold text-lg">
              {isPositive ? '+' : ''}{change.toFixed(2)}%
            </span>
            <span className="text-muted-foreground text-sm">24h</span>
          </div>

          {athDistance !== null && (
            <div className="text-muted-foreground text-sm">
              <span className="font-mono">{athDistance.toFixed(1)}%</span> from ATH
              {forexData.ath_price && (
                <span className="ml-1">(${forexData.ath_price.toLocaleString(undefined, { minimumFractionDigits: 2 })})</span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-6 text-sm">
          {forexData.high_24h && (
            <div>
              <span className="text-muted-foreground">24h High:</span>
              <span className="ml-2 font-mono font-medium text-green-500">
                ${forexData.high_24h.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
          {forexData.low_24h && (
            <div>
              <span className="text-muted-foreground">24h Low:</span>
              <span className="ml-2 font-mono font-medium text-red-500">
                ${forexData.low_24h.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
