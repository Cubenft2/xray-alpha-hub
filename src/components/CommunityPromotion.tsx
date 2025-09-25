import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, X, TrendingUp, Users, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface PromotionData {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  token: {
    symbol: string;
    name: string;
    chain: string;
    chainColor: string;
  };
  links: {
    buy?: string;
    chart?: string;
    chartAlt?: string;
    website?: string;
    twitter?: string;
  };
  features: string[];
  isActive: boolean;
}

const CURRENT_PROMOTION: PromotionData = {
  id: 'gugo_abstract_2025',
  title: '🚀 Community Spotlight: $GUGO',
  subtitle: 'Early Access to Abstract Chain Gem',
  description: 'Join our community in supporting $GUGO, an exciting new memecoin on the innovative Abstract Chain - Ethereum L2 by Pudgy Penguins team.',
  token: {
    symbol: 'GUGO',
    name: 'GUGO Token',
    chain: 'Abstract Chain',
    chainColor: 'hsl(280 100% 70%)'
  },
  links: {
    chart: 'https://dexscreener.com/abstract/gugo',
    chartAlt: 'https://www.coingecko.com/en/coins/gugo',
    website: 'https://abstract.xyz',
    twitter: 'https://twitter.com/AbstractChain'
  },
  features: [
    'Built on Abstract Chain (Ethereum L2)',
    'Backed by Pudgy Penguins ecosystem',
    'Early stage opportunity',
    'Community-driven project'
  ],
  isActive: true
};

export const CommunityPromotion: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!CURRENT_PROMOTION.isActive) return;

    // Check if user has dismissed this promotion
    const dismissedKey = `promotion_dismissed_${CURRENT_PROMOTION.id}`;
    const wasDismissed = localStorage.getItem(dismissedKey);
    
    if (wasDismissed) {
      setDismissed(true);
      return;
    }

    // Show popup after 3 seconds if not dismissed
    const timer = setTimeout(() => {
      if (!dismissed) {
        setIsOpen(true);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [dismissed]);

  const handleDismiss = (remember: boolean = false) => {
    setIsOpen(false);
    if (remember) {
      const dismissedKey = `promotion_dismissed_${CURRENT_PROMOTION.id}`;
      localStorage.setItem(dismissedKey, 'true');
      setDismissed(true);
    }
  };

  const handleLinkClick = (url: string, type: string, fallbackUrl?: string) => {
    try {
      // Create a temporary link element for better compatibility
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Opening chart",
        description: `Redirecting to ${type}...`,
      });
    } catch (error) {
      console.error('Failed to open link:', error);
      
      if (fallbackUrl) {
        // Try fallback URL
        const fallbackLink = document.createElement('a');
        fallbackLink.href = fallbackUrl;
        fallbackLink.target = '_blank';
        fallbackLink.rel = 'noopener noreferrer';
        fallbackLink.style.display = 'none';
        
        document.body.appendChild(fallbackLink);
        fallbackLink.click();
        document.body.removeChild(fallbackLink);
        
        toast({
          title: "Using alternative chart",
          description: "Opened alternative chart source",
        });
      } else {
        toast({
          title: "Link failed to open",
          description: "Please try copying the URL manually",
          variant: "destructive"
        });
      }
    }
  };

  if (!CURRENT_PROMOTION.isActive || dismissed) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleDismiss()}>
      <DialogContent className="max-w-md mx-auto bg-card border border-primary/20 shadow-xl">
        <DialogHeader className="text-center space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex-1" />
            <Sparkles className="h-6 w-6 text-accent animate-pulse" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDismiss(false)}
              className="h-8 w-8 p-0 hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <DialogTitle className="text-xl font-bold xr-gradient-text leading-tight">
            {CURRENT_PROMOTION.title}
          </DialogTitle>
          
          <div className="flex items-center justify-center gap-2">
            <Badge 
              variant="secondary" 
              className="bg-accent/20 text-accent-foreground border-accent/30"
            >
              <Users className="h-3 w-3 mr-1" />
              Community Pick
            </Badge>
            <Badge 
              variant="outline"
              style={{ borderColor: CURRENT_PROMOTION.token.chainColor, color: CURRENT_PROMOTION.token.chainColor }}
            >
              {CURRENT_PROMOTION.token.chain}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Token Info */}
          <div className="text-center p-4 bg-muted/50 rounded-lg border border-border">
            <div className="text-2xl font-bold text-primary mb-1">
              ${CURRENT_PROMOTION.token.symbol}
            </div>
            <div className="text-sm text-muted-foreground">
              {CURRENT_PROMOTION.token.name}
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground text-center leading-relaxed">
            {CURRENT_PROMOTION.description}
          </p>

          {/* Features */}
          <div className="space-y-2">
            <div className="text-sm font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-success" />
              Key Highlights:
            </div>
            <ul className="space-y-1">
              {CURRENT_PROMOTION.features.map((feature, index) => (
                <li key={index} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="text-accent mt-1">•</span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            {CURRENT_PROMOTION.links.chart && (
              <Button
                onClick={() => handleLinkClick(
                  CURRENT_PROMOTION.links.chart!, 
                  'DexScreener chart', 
                  CURRENT_PROMOTION.links.chartAlt
                )}
                className="btn-hero text-sm h-9"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                View Chart
              </Button>
            )}
            {CURRENT_PROMOTION.links.website && (
              <Button
                variant="outline"
                onClick={() => handleLinkClick(CURRENT_PROMOTION.links.website!, 'website')}
                className="text-sm h-9 border-primary/30 hover:bg-primary/10"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Learn More
              </Button>
            )}
          </div>

          {/* Disclaimer */}
          <div className="text-xs text-muted-foreground/80 text-center p-3 bg-warning/10 rounded border border-warning/20">
            ⚠️ <strong>DYOR:</strong> This is a community spotlight, not financial advice. 
            Always research before investing in any cryptocurrency.
          </div>

          {/* Dismiss Options */}
          <div className="flex justify-between items-center pt-2 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDismiss(true)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Don't show again
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDismiss(false)}
              className="text-xs"
            >
              Maybe later
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};