import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function BriefReference() {
  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">📊 XRay Crypto Brief Reference</h1>
        <p className="text-muted-foreground">Guidelines and structure for professional crypto market briefs</p>
      </div>

      {/* Brief Structure */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>📋 Brief Structure (6 Sections)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-1">1. Market Overview (200-300 words)</h3>
            <p className="text-sm text-muted-foreground">Bitcoin, Ethereum, total market cap, Fear & Greed Index, top mover</p>
          </div>
          
          <div>
            <h3 className="font-semibold mb-1">2. Cryptocurrency Movers (300-400 words) - MAIN SECTION</h3>
            <p className="text-sm text-muted-foreground">Top 6-8 crypto gainers/losers with detailed WHY - on-chain metrics, social sentiment, protocol news</p>
          </div>
          
          <div>
            <h3 className="font-semibold mb-1">3. DeFi & Layer 1 Activity (150-200 words)</h3>
            <p className="text-sm text-muted-foreground">DeFi protocols (Uniswap, Aave, Curve), Layer 1 chains (Ethereum, Solana, Avalanche), Layer 2 solutions</p>
          </div>
          
          <div>
            <h3 className="font-semibold mb-1">4. Derivatives & Flows (150-250 words)</h3>
            <p className="text-sm text-muted-foreground">Funding rates, liquidations, open interest, exchange flows, technical indicators</p>
          </div>
          
          <div>
            <h3 className="font-semibold mb-1">5. Macro Context (80-120 words MAX) - KEEP SHORT!</h3>
            <p className="text-sm text-muted-foreground">Crypto stocks (COIN, MSTR) ONLY if big moves, major indices for risk sentiment ONLY</p>
          </div>
          
          <div>
            <h3 className="font-semibold mb-1">6. What's Next (120-180 words)</h3>
            <p className="text-sm text-muted-foreground">Key support/resistance, upcoming catalysts, economic calendar ONLY if directly impacts crypto</p>
          </div>
        </CardContent>
      </Card>

      {/* Content Focus */}
      <Card className="mb-6 border-primary">
        <CardHeader>
          <CardTitle>🎯 CRITICAL: Content Focus</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="font-semibold text-lg">90% Crypto / 10% Macro</p>
            <p className="text-sm text-muted-foreground">This is a CRYPTO platform, not stocks!</p>
            <ul className="list-disc list-inside text-sm space-y-1 mt-2">
              <li>Focus: Bitcoin, Ethereum, altcoins, DeFi, Layer 1s/2s</li>
              <li>Stocks only when relevant to crypto (COIN big move, etc.)</li>
              <li>Macro only for context (risk sentiment, dollar strength)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Formatting Rules */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>✍️ Formatting Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Asset Mention Format (MANDATORY)</h3>
            <div className="bg-success/10 border border-success/20 p-3 rounded mb-2">
              <p className="text-sm font-mono">✅ Bitcoin (BTC $106,729 -4.5%): Analysis here...</p>
              <p className="text-sm font-mono">✅ Ethereum (ETH $3,775 -6.7%): Analysis here...</p>
            </div>
            <div className="bg-destructive/10 border border-destructive/20 p-3 rounded">
              <p className="text-sm font-mono">❌ BTC fell 4.5%</p>
              <p className="text-sm font-mono">❌ Bitcoin price: $106,729</p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Banned Phrases</h3>
            <div className="flex flex-wrap gap-2">
              <span className="px-2 py-1 bg-destructive/20 text-destructive text-xs rounded">Making waves</span>
              <span className="px-2 py-1 bg-destructive/20 text-destructive text-xs rounded">To the moon</span>
              <span className="px-2 py-1 bg-destructive/20 text-destructive text-xs rounded">Diamond hands</span>
              <span className="px-2 py-1 bg-destructive/20 text-destructive text-xs rounded">Not financial advice</span>
              <span className="px-2 py-1 bg-destructive/20 text-destructive text-xs rounded">By Xavier Rodriguez</span>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Good Phrases</h3>
            <div className="flex flex-wrap gap-2">
              <span className="px-2 py-1 bg-success/20 text-success text-xs rounded">Positioning</span>
              <span className="px-2 py-1 bg-success/20 text-success text-xs rounded">Volume confirms</span>
              <span className="px-2 py-1 bg-success/20 text-success text-xs rounded">Data shows</span>
              <span className="px-2 py-1 bg-success/20 text-success text-xs rounded">Pattern suggests</span>
              <span className="px-2 py-1 bg-success/20 text-success text-xs rounded">Could/might/appears</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* XRay Persona */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>👤 The XRay Persona - Xavier Rodriguez</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p><strong>Age:</strong> 38 years old</p>
          <p><strong>Trading Since:</strong> 2013 (12 years experience)</p>
          <p><strong>Location:</strong> Denver, Colorado</p>
          <p><strong>Background:</strong> Survived Mt. Gox (2014), 2018 crash, rebuilt through discipline</p>
          <p><strong>Philosophy:</strong> "The market doesn't care about your feelings. Data doesn't lie."</p>
          
          <div className="mt-4">
            <h4 className="font-semibold mb-2">Writing Style by Time:</h4>
            <ul className="text-sm space-y-1">
              <li><strong>6 AM-12 PM:</strong> Direct Trader (short, punchy sentences)</li>
              <li><strong>12 PM-6 PM:</strong> Market Psychologist (conversational, explanatory)</li>
              <li><strong>6 PM-6 AM:</strong> Data Detective (investigative, pattern recognition)</li>
            </ul>
          </div>

          <div className="mt-4 p-3 bg-warning/10 border border-warning/20 rounded">
            <p className="font-semibold text-sm">⚠️ CRITICAL RULE:</p>
            <p className="text-sm">NEVER include byline "By Xavier Rodriguez" - the persona is in the voice, not a byline!</p>
          </div>
        </CardContent>
      </Card>

      {/* Chart Links Template */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>📊 Chart Links (Always Include at End)</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded text-xs overflow-x-auto">
{`## 📊 Interactive Charts & Data

**Bitcoin (BTC):** [Live Chart →](https://www.tradingview.com/symbols/BTCUSD/)
**Ethereum (ETH):** [Live Chart →](https://www.tradingview.com/symbols/ETHUSD/)
**DeFi Dashboard:** [DeFiLlama →](https://defillama.com/)
**Fear & Greed Index:** [View Index →](https://alternative.me/crypto/fear-and-greed-index/)`}
          </pre>
        </CardContent>
      </Card>

      {/* Target Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>🎯 Target Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Word Count</p>
              <p className="text-2xl font-bold">1,800-2,200</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Featured Assets</p>
              <p className="text-2xl font-bold">6-10</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Crypto Focus</p>
              <p className="text-2xl font-bold text-primary">90%</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Macro Context</p>
              <p className="text-2xl font-bold text-muted-foreground">10%</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
