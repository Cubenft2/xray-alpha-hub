import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Quote } from 'lucide-react';

interface StoicQuoteProps {
  quote: string;
  author?: string;
}

export function StoicQuote({ quote, author }: StoicQuoteProps) {
  if (!quote) return null;

  return (
    <Card className="xr-card bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <Quote className="w-8 h-8 text-primary/60 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <blockquote className="text-lg italic leading-relaxed text-foreground/90 mb-3">
              "{quote}"
            </blockquote>
            <cite className="text-sm text-muted-foreground font-medium not-italic">
              — {author || 'Daily Wisdom'}
            </cite>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}