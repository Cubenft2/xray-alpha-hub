import React from 'react';
import { Card } from '@/components/ui/card';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

interface COTReport {
  swap_net: number | null;
  managed_net: number | null;
  swap_net_change: number | null;
  managed_net_change: number | null;
}

interface ForexCard {
  rsi_14: number | null;
  change_24h_pct: number | null;
}

interface MarketVerdictProps {
  cotData: COTReport | null;
  forexData: ForexCard | null;
  metal: 'silver' | 'gold' | 'platinum' | 'palladium';
}

interface VerdictItem {
  type: 'bullish' | 'bearish' | 'neutral';
  text: string;
}

export function MarketVerdict({ cotData, forexData, metal }: MarketVerdictProps) {
  if (!cotData && !forexData) {
    return null;
  }

  const verdicts: VerdictItem[] = [];

  // Analyze bank positioning
  if (cotData?.swap_net != null) {
    const bankNet = cotData.swap_net;
    if (bankNet < -50000) {
      verdicts.push({
        type: 'bullish',
        text: 'Banks heavily short — historically precedes rallies'
      });
    } else if (bankNet < -20000) {
      verdicts.push({
        type: 'neutral',
        text: 'Banks moderately short — typical positioning'
      });
    } else if (bankNet > 0) {
      verdicts.push({
        type: 'bearish',
        text: 'Banks net long — unusual, may signal top'
      });
    }
  }

  // Analyze speculator positioning
  if (cotData?.managed_net != null) {
    const specNet = cotData.managed_net;
    if (specNet > 80000) {
      verdicts.push({
        type: 'bearish',
        text: 'Specs extremely long — crowded trade risk'
      });
    } else if (specNet < 20000) {
      verdicts.push({
        type: 'bullish',
        text: 'Specs lightly positioned — room to add'
      });
    }
  }

  // Analyze week-over-week changes
  if (cotData?.swap_net_change != null) {
    const change = cotData.swap_net_change;
    if (change > 10000) {
      verdicts.push({
        type: 'bearish',
        text: 'Banks covered shorts this week'
      });
    } else if (change < -10000) {
      verdicts.push({
        type: 'bullish',
        text: 'Banks added to shorts this week'
      });
    }
  }

  // RSI analysis
  if (forexData?.rsi_14 != null) {
    const rsi = forexData.rsi_14;
    if (rsi > 70) {
      verdicts.push({
        type: 'bearish',
        text: `RSI ${rsi.toFixed(0)} — overbought territory`
      });
    } else if (rsi < 30) {
      verdicts.push({
        type: 'bullish',
        text: `RSI ${rsi.toFixed(0)} — oversold territory`
      });
    }
  }

  // Price momentum
  if (forexData?.change_24h_pct != null) {
    const change = forexData.change_24h_pct;
    if (change > 2) {
      verdicts.push({
        type: 'bullish',
        text: `Strong momentum: +${change.toFixed(1)}% today`
      });
    } else if (change < -2) {
      verdicts.push({
        type: 'bearish',
        text: `Selling pressure: ${change.toFixed(1)}% today`
      });
    }
  }

  if (verdicts.length === 0) {
    verdicts.push({
      type: 'neutral',
      text: 'Market conditions neutral — no strong signals'
    });
  }

  const getIcon = (type: VerdictItem['type']) => {
    switch (type) {
      case 'bullish':
        return <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />;
      case 'bearish':
        return <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />;
    }
  };

  const bullishCount = verdicts.filter(v => v.type === 'bullish').length;
  const bearishCount = verdicts.filter(v => v.type === 'bearish').length;
  const overallBias = bullishCount > bearishCount ? 'Bullish' : bearishCount > bullishCount ? 'Bearish' : 'Neutral';
  const biasColor = bullishCount > bearishCount ? 'text-green-500' : bearishCount > bullishCount ? 'text-red-500' : 'text-yellow-500';

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold">🎯 Market Analysis</h3>
        <span className={`font-bold ${biasColor}`}>{overallBias} Bias</span>
      </div>

      <div className="space-y-3">
        {verdicts.map((verdict, index) => (
          <div key={index} className="flex items-start gap-3">
            {getIcon(verdict.type)}
            <span className="text-sm">{verdict.text}</span>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Analysis based on CFTC COT data and technical indicators. Not financial advice.
      </p>
    </Card>
  );
}
