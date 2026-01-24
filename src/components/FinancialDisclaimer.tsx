import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X } from 'lucide-react';

export const FinancialDisclaimer: React.FC = () => {
  const [isVisible, setIsVisible] = useState(() => {
    // Check if user has dismissed the disclaimer in the last 24 hours
    const dismissedTime = localStorage.getItem('financial_disclaimer_dismissed');
    if (dismissedTime) {
      const dismissedAt = new Date(dismissedTime);
      const now = new Date();
      const hoursSinceDismissed = (now.getTime() - dismissedAt.getTime()) / (1000 * 60 * 60);
      return hoursSinceDismissed > 24; // Show again after 24 hours
    }
    return true;
  });

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('financial_disclaimer_dismissed', new Date().toISOString());
  };

  if (!isVisible) return null;

  return (
    <Card className="mb-6 border-warning/20 bg-warning/5">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-warning mt-0.5 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-warning">Important Disclaimer</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              <strong>This is not financial advice.</strong> XRayCrypto™ provides educational content and market data for informational purposes only. 
              All investments carry risk of loss. Past performance does not guarantee future results. 
              Always conduct your own research and consult with qualified financial advisors before making investment decisions.
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <a href="/about" className="text-primary hover:underline">Learn more about us</a>
              <span className="text-muted-foreground">•</span>
              <a href="/terms" className="text-muted-foreground hover:text-foreground">Terms of Service</a>
              <span className="text-muted-foreground">•</span>
              <a href="/privacy" className="text-muted-foreground hover:text-foreground">Privacy Policy</a>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};