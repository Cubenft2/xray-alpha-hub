import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';

interface MetalsCardsProps {
  onSelectSymbol?: (symbol: string) => void;
}

export function MetalsCards({ onSelectSymbol }: MetalsCardsProps) {
  const { data: metals, isLoading } = useQuery({
    queryKey: ['forex-metals-cards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forex_cards')
        .select('*')
        .in('pair', ['XAUUSD', 'XAGUSD'])
        .eq('is_active', true);
      
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  const gold = metals?.find(m => m.pair === 'XAUUSD');
  const silver = metals?.find(m => m.pair === 'XAGUSD');

  const getMetalSlug = (pair: string) => {
    const slugMap: Record<string, string> = {
      'XAUUSD': 'gold',
      'XAGUSD': 'silver'
    };
    return slugMap[pair] || pair.toLowerCase();
  };

  const MetalCard = ({ metal, icon, name, gradientClass }: { 
    metal: typeof gold; 
    icon: string; 
    name: string;
    gradientClass: string;
  }) => {
    if (!metal) return null;
    
    const change = metal.change_24h_pct || 0;
    const isPositive = change >= 0;
    // USD-denominated metals use OANDA, others use FX_IDC
    const isUsdPair = metal.pair.endsWith('USD');
    const tradingViewSymbol = isUsdPair ? `OANDA:${metal.pair}` : `FX_IDC:${metal.pair}`;

    return (
      <Card 
        className="p-6 cursor-pointer hover:border-primary/50 transition-all hover:shadow-lg"
        onClick={() => onSelectSymbol?.(tradingViewSymbol)}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{icon}</span>
            <div>
              <h3 className="text-lg font-bold">{name}</h3>
              <p className="text-xs text-muted-foreground">{metal.pair}</p>
            </div>
          </div>
          {metal.technical_signal && (
            <Badge variant={metal.technical_signal.includes('buy') ? 'default' : 'secondary'}>
              {metal.technical_signal}
            </Badge>
          )}
        </div>

        <div className="space-y-3">
          <div className={`text-4xl font-bold font-mono ${gradientClass}`}>
            ${metal.rate?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className={`flex items-center gap-1 ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span className="font-mono font-medium">
                {isPositive ? '+' : ''}{change.toFixed(2)}%
              </span>
            </div>
            
            {metal.rsi_14 && (
              <div className="text-muted-foreground">
                RSI: <span className="font-mono">{metal.rsi_14.toFixed(0)}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div>
              H: <span className="font-mono">${metal.high_24h?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div>
              L: <span className="font-mono">${metal.low_24h?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            {metal.spread_pips && (
              <div>
                Spread: <span className="font-mono">{metal.spread_pips.toFixed(1)} pips</span>
              </div>
            )}
          </div>
        </div>

        <Link 
          to={`/forex/${getMetalSlug(metal.pair)}`}
          className="mt-4 flex items-center justify-center gap-2 text-sm text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-4 h-4" />
          View Deep Dive
        </Link>
      </Card>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <MetalCard metal={gold} icon="🥇" name="Gold" gradientClass="gold-price-gradient" />
      <MetalCard metal={silver} icon="🥈" name="Silver" gradientClass="silver-price-gradient" />
    </div>
  );
}
