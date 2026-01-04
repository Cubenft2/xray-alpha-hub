import React, { useState, Suspense } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { TradingViewChart } from '@/components/TradingViewChart';
import { Skeleton } from '@/components/ui/skeleton';

interface ChartToggleProps {
  metal: 'silver' | 'gold';
}

export function ChartToggle({ metal }: ChartToggleProps) {
  const [chartType, setChartType] = useState<'spot' | 'futures'>('spot');

  const getSymbol = () => {
    if (chartType === 'spot') {
      return metal === 'gold' ? 'OANDA:XAUUSD' : 'OANDA:XAGUSD';
    } else {
      return metal === 'gold' ? 'COMEX:GC1!' : 'COMEX:SI1!';
    }
  };

  const getLabel = () => {
    if (chartType === 'spot') {
      return metal === 'gold' ? 'XAU/USD Spot' : 'XAG/USD Spot';
    } else {
      return metal === 'gold' ? 'Gold Futures (GC1!)' : 'Silver Futures (SI1!)';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">📈 Price Chart</h3>
        <ToggleGroup 
          type="single" 
          value={chartType} 
          onValueChange={(value) => value && setChartType(value as 'spot' | 'futures')}
          className="bg-muted rounded-lg p-1"
        >
          <ToggleGroupItem 
            value="spot" 
            className="text-xs px-3 py-1 data-[state=on]:bg-background data-[state=on]:shadow-sm"
          >
            Spot
          </ToggleGroupItem>
          <ToggleGroupItem 
            value="futures" 
            className="text-xs px-3 py-1 data-[state=on]:bg-background data-[state=on]:shadow-sm"
          >
            Futures
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      
      <p className="text-xs text-muted-foreground">
        Viewing: {getLabel()}
      </p>

      <Suspense fallback={<Skeleton className="h-[500px] w-full rounded-lg" />}>
        <TradingViewChart symbol={getSymbol()} height="500px" />
      </Suspense>
    </div>
  );
}
