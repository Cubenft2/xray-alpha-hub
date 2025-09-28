import React from 'react';
import { FearGreedWidget } from './FearGreedWidget';
import { TrendingCoinsWidget } from './TrendingCoinsWidget';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { DollarSign, TrendingUp } from 'lucide-react';

// Mock data for ETF flows and stablecoin supply
const mockETFFlows = [
  { day: 'Mon', flow: 120 },
  { day: 'Tue', flow: -45 },
  { day: 'Wed', flow: 200 },
  { day: 'Thu', flow: 89 },
  { day: 'Fri', flow: 156 },
  { day: 'Sat', flow: 67 },
  { day: 'Sun', flow: 134 }
];

const mockStablecoinSupply = [
  { day: 'Jan', supply: 120 },
  { day: 'Feb', supply: 125 },
  { day: 'Mar', supply: 123 },
  { day: 'Apr', supply: 128 },
  { day: 'May', supply: 132 },
  { day: 'Jun', supply: 129 }
];

interface SidebarWidgetsProps {
  fearGreedScore?: number;
  fearGreedLabel?: string;
}

export function SidebarWidgets({ fearGreedScore, fearGreedLabel }: SidebarWidgetsProps) {
  return (
    <div className="space-y-6">
      {/* Fear & Greed Index */}
      <FearGreedWidget 
        score={fearGreedScore} 
        label={fearGreedLabel}
        className="w-full"
      />

      {/* Social Buzz - Top 5 Trending */}
      <TrendingCoinsWidget limit={5} />

      {/* ETF Flows Tracker */}
      <Card className="xr-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-success" />
            ETF Flows
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 mb-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mockETFFlows}>
                <XAxis 
                  dataKey="day" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10 }}
                />
                <YAxis hide />
                <Line 
                  type="monotone" 
                  dataKey="flow" 
                  stroke="hsl(var(--success))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--success))', strokeWidth: 0, r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="text-success font-semibold">+$721M</span>
              <span className="text-xs text-muted-foreground ml-1">7D</span>
            </div>
            <Badge variant="outline" className="text-xs font-pixel">
              Bitcoin ETF
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Stablecoin Supply */}
      <Card className="xr-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5 text-accent" />
            Stablecoin Supply
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 mb-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mockStablecoinSupply}>
                <XAxis 
                  dataKey="day" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10 }}
                />
                <YAxis hide />
                <Line 
                  type="monotone" 
                  dataKey="supply" 
                  stroke="hsl(var(--accent))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--accent))', strokeWidth: 0, r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="text-accent font-semibold">$129B</span>
              <span className="text-xs text-muted-foreground ml-1">Total</span>
            </div>
            <Badge variant="outline" className="text-xs font-pixel">
              USDT + USDC
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}