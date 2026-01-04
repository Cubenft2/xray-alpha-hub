import React from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface COTReport {
  swap_net: number | null;
  managed_net: number | null;
  open_interest: number | null;
}

interface FuturesCard {
  contract_size: number | null;
  open_interest: number | null;
}

interface KeyStatsGridProps {
  cotData: COTReport | null;
  futuresData: FuturesCard | null;
  isLoading: boolean;
  metal: 'silver' | 'gold' | 'platinum' | 'palladium';
}

const contractInfo: Record<string, { size: number; dollarMove: string; exchange: string }> = {
  gold: { size: 100, dollarMove: '$100', exchange: 'COMEX GC' },
  silver: { size: 5000, dollarMove: '$5,000', exchange: 'COMEX SI' },
  platinum: { size: 50, dollarMove: '$50', exchange: 'NYMEX PL' },
  palladium: { size: 100, dollarMove: '$100', exchange: 'NYMEX PA' }
};

interface StatCardProps {
  label: string;
  value: string;
  subtext?: string;
  icon: string;
}

function StatCard({ label, value, subtext, icon }: StatCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-lg font-bold font-mono truncate">{value}</p>
          {subtext && (
            <p className="text-xs text-muted-foreground truncate">{subtext}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

export function KeyStatsGrid({ cotData, futuresData, isLoading, metal }: KeyStatsGridProps) {
  const { size: contractSize, dollarMove: dollarMoveImpact, exchange } = contractInfo[metal] || contractInfo.gold;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="p-4">
            <Skeleton className="h-4 w-16 mb-2" />
            <Skeleton className="h-6 w-24" />
          </Card>
        ))}
      </div>
    );
  }

  const formatContracts = (num: number | null) => {
    if (num === null) return 'N/A';
    const absNum = Math.abs(num);
    if (absNum >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  const formatOunces = (contracts: number | null) => {
    if (contracts === null) return null;
    const ounces = Math.abs(contracts) * contractSize;
    if (ounces >= 1000000) {
      return `${(ounces / 1000000).toFixed(1)}M oz`;
    }
    if (ounces >= 1000) {
      return `${(ounces / 1000).toFixed(0)}K oz`;
    }
    return `${ounces.toLocaleString()} oz`;
  };

  const bankPosition = cotData?.swap_net || 0;
  const specPosition = cotData?.managed_net || 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard
        icon="🏦"
        label="Banks Net Position"
        value={`${bankPosition >= 0 ? '+' : ''}${formatContracts(bankPosition)}`}
        subtext={formatOunces(bankPosition) || undefined}
      />
      <StatCard
        icon="💵"
        label="$1 Move Impact"
        value={dollarMoveImpact}
        subtext="per contract"
      />
      <StatCard
        icon="💼"
        label="Specs Net Position"
        value={`${specPosition >= 0 ? '+' : ''}${formatContracts(specPosition)}`}
        subtext={formatOunces(specPosition) || undefined}
      />
      <StatCard
        icon="📦"
        label="Contract Size"
        value={`${contractSize.toLocaleString()} oz`}
        subtext={exchange}
      />
    </div>
  );
}
