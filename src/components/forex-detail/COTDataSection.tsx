import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

interface COTReport {
  report_date: string;
  as_of_date: string;
  swap_long: number | null;
  swap_short: number | null;
  swap_net: number | null;
  swap_net_change: number | null;
  producer_long: number | null;
  producer_short: number | null;
  producer_net: number | null;
  managed_long: number | null;
  managed_short: number | null;
  managed_net: number | null;
  managed_net_change: number | null;
  other_long: number | null;
  other_short: number | null;
  other_net: number | null;
  open_interest: number | null;
}

interface COTDataSectionProps {
  cotData: COTReport[] | null;
  isLoading: boolean;
  metal: 'silver' | 'gold' | 'platinum' | 'palladium';
}

interface PositionBarProps {
  label: string;
  longValue: number;
  shortValue: number;
  netValue: number;
  netChange?: number | null;
  maxValue: number;
}

function PositionBar({ label, longValue, shortValue, netValue, netChange, maxValue }: PositionBarProps) {
  const longWidth = maxValue > 0 ? (longValue / maxValue) * 100 : 0;
  const shortWidth = maxValue > 0 ? (shortValue / maxValue) * 100 : 0;
  
  const formatNum = (num: number) => {
    if (Math.abs(num) >= 1000) {
      return `${(num / 1000).toFixed(0)}K`;
    }
    return num.toLocaleString();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <Badge variant={netValue >= 0 ? 'default' : 'destructive'} className="font-mono text-xs">
            {netValue >= 0 ? '+' : ''}{formatNum(netValue)}
          </Badge>
          {netChange !== null && netChange !== undefined && (
            <span className={`text-xs font-mono ${netChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              ({netChange >= 0 ? '+' : ''}{formatNum(netChange)})
            </span>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-1 h-6">
        {/* Long bar (green) */}
        <div className="flex-1 h-full bg-muted rounded overflow-hidden">
          <div 
            className="h-full bg-green-500/80 transition-all duration-500"
            style={{ width: `${Math.min(longWidth, 100)}%` }}
          />
        </div>
        
        {/* Divider */}
        <div className="w-px h-full bg-border" />
        
        {/* Short bar (red) */}
        <div className="flex-1 h-full bg-muted rounded overflow-hidden">
          <div 
            className="h-full bg-red-500/80 transition-all duration-500"
            style={{ width: `${Math.min(shortWidth, 100)}%` }}
          />
        </div>
      </div>
      
      <div className="flex justify-between text-xs text-muted-foreground font-mono">
        <span>Long: {formatNum(longValue)}</span>
        <span>Short: {formatNum(shortValue)}</span>
      </div>
    </div>
  );
}

export function COTDataSection({ cotData, isLoading, metal }: COTDataSectionProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="space-y-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 w-full" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (!cotData || cotData.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-bold mb-4">📊 CFTC Positioning Data</h3>
        <p className="text-muted-foreground">No COT data available.</p>
      </Card>
    );
  }

  const latest = cotData[0];
  
  // Calculate max value for scaling bars
  const allValues = [
    latest.swap_long || 0,
    latest.swap_short || 0,
    latest.producer_long || 0,
    latest.producer_short || 0,
    latest.managed_long || 0,
    latest.managed_short || 0,
    latest.other_long || 0,
    latest.other_short || 0,
  ];
  const maxValue = Math.max(...allValues, 1);

  const asOfDate = new Date(latest.as_of_date);
  
  // Calculate data freshness
  const daysSinceReport = Math.floor(
    (Date.now() - asOfDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const freshnessText = daysSinceReport <= 7 
    ? 'Current week' 
    : daysSinceReport <= 14 
      ? 'Last week' 
      : `${daysSinceReport} days ago`;
  const freshnessVariant = daysSinceReport <= 7 ? 'default' : daysSinceReport <= 14 ? 'secondary' : 'outline';

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold">📊 CFTC Positioning Data</h3>
        <div className="text-right">
          <div className="flex items-center gap-2 justify-end mb-1">
            <Badge variant={freshnessVariant as 'default' | 'secondary' | 'outline'} className="text-xs">
              {freshnessText}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">As of</p>
          <p className="text-sm font-mono">{format(asOfDate, 'MMM d, yyyy')}</p>
        </div>
      </div>

      <div className="grid gap-6">
        <PositionBar
          label="🏦 Swap Dealers (Banks)"
          longValue={latest.swap_long || 0}
          shortValue={latest.swap_short || 0}
          netValue={latest.swap_net || 0}
          netChange={latest.swap_net_change}
          maxValue={maxValue}
        />
        
        <PositionBar
          label="🏭 Producers/Merchants"
          longValue={latest.producer_long || 0}
          shortValue={latest.producer_short || 0}
          netValue={latest.producer_net || 0}
          maxValue={maxValue}
        />
        
        <PositionBar
          label="💼 Managed Money (Specs)"
          longValue={latest.managed_long || 0}
          shortValue={latest.managed_short || 0}
          netValue={latest.managed_net || 0}
          netChange={latest.managed_net_change}
          maxValue={maxValue}
        />
        
        <PositionBar
          label="📈 Other Reportables"
          longValue={latest.other_long || 0}
          shortValue={latest.other_short || 0}
          netValue={latest.other_net || 0}
          maxValue={maxValue}
        />
      </div>

      {latest.open_interest && (
        <div className="mt-6 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Open Interest</span>
            <span className="font-mono font-bold">{latest.open_interest.toLocaleString()} contracts</span>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-500/80 rounded" />
          <span>Long</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-500/80 rounded" />
          <span>Short</span>
        </div>
      </div>

      {/* Data explanation */}
      <div className="mt-4 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-medium">About this data:</span> The CFTC releases 
          Commitment of Traders reports every <span className="font-medium">Friday 
          at ~3:30pm ET</span>, reflecting futures positions as of the prior Tuesday. 
          During holidays, releases may be delayed.
        </p>
        <a 
          href="https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground underline hover:text-foreground transition-colors mt-1 inline-block"
        >
          Source: CFTC Disaggregated COT Report
        </a>
      </div>
    </Card>
  );
}
