import React, { useState, Suspense } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { TradingViewChart } from '@/components/TradingViewChart';
import { Skeleton } from '@/components/ui/skeleton';

interface ChartToggleProps {
  metal: 'silver' | 'gold' | 'platinum' | 'palladium';
}

const spotSymbols: Record<string, string> = {
  gold: 'OANDA:XAUUSD',
  silver: 'OANDA:XAGUSD',
  platinum: 'OANDA:XPTUSD',
  palladium: 'OANDA:XPDUSD'
};

const futuresSymbols: Record<string, string> = {
  gold: 'COMEX:GC1!',
  silver: 'COMEX:SI1!',
  platinum: 'NYMEX:PL1!',
  palladium: 'NYMEX:PA1!'
};

const spotLabels: Record<string, string> = {
  gold: 'XAU/USD Spot',
  silver: 'XAG/USD Spot',
  platinum: 'XPT/USD Spot',
  palladium: 'XPD/USD Spot'
};

const futuresLabels: Record<string, string> = {
  gold: 'Gold Futures (GC1!)',
  silver: 'Silver Futures (SI1!)',
  platinum: 'Platinum Futures (PL1!)',
  palladium: 'Palladium Futures (PA1!)'
};

export function ChartToggle({ metal }: ChartToggleProps) {
  const [chartType, setChartType] = useState<'spot' | 'futures'>('spot');

  const getSymbol = () => {
    return chartType === 'spot' 
      ? spotSymbols[metal] || spotSymbols.gold
      : futuresSymbols[metal] || futuresSymbols.gold;
  };

  const getLabel = () => {
    return chartType === 'spot'
      ? spotLabels[metal] || spotLabels.gold
      : futuresLabels[metal] || futuresLabels.gold;
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
