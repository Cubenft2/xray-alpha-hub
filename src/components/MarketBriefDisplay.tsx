import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { TradingViewChart } from '@/components/TradingViewChart';
import { MiniChart } from '@/components/MiniChart';
import { Calendar, Eye, TrendingUp, TrendingDown, Activity, Target, Waves, Compass } from 'lucide-react';

interface MarketBrief {
  id: string;
  brief_type: string;
  title: string;
  slug: string;
  executive_summary: string;
  content_sections: any;
  social_data: any;
  market_data: any;
  stoic_quote: string | null;
  featured_assets: string[];
  sentiment_score: number | null;
  view_count: number;
  published_at: string;
  created_at: string;
}

interface MarketBriefDisplayProps {
  brief: MarketBrief;
}

export function MarketBriefDisplay({ brief }: MarketBriefDisplayProps) {
  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">{brief.title}</CardTitle>
          <div className="flex items-center justify-center gap-2 mt-2">
            <Badge>{new Date(brief.published_at).toLocaleDateString()}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">Executive Summary</h3>
            <p className="text-muted-foreground leading-relaxed">{brief.executive_summary}</p>
          </div>
          
          {brief.content_sections?.ai_generated_content && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Market Analysis</h3>
              <div className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {brief.content_sections.ai_generated_content}
              </div>
            </div>
          )}

          {brief.stoic_quote && (
            <div className="bg-muted p-4 rounded-lg border-l-4 border-primary">
              <p className="italic text-center font-medium">"{brief.stoic_quote}"</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}