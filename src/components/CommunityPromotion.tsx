import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, X, TrendingUp, Users, Sparkles, Copy } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import gugoAnimated from "@/assets/gugo-animated.gif";

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
    chartAlt2?: string;
    website?: string;
    twitter?: string;
    community?: string;
  };
  features: string[];
  isActive: boolean;
}

const CURRENT_PROMOTION: PromotionData = {
  id: 'gugo_abstract_2025',
  title: '🚀 Community Spotlight: $GUGO',
  subtitle: 'Early Access to Abstract Chain Gem',
  description: '$GUGO is an emerging memecoin on Abstract Chain, Ethereum L2.',
  token: {
    symbol: 'GUGO',
    name: 'GUGO Token',
    chain: 'Abstract Chain',
    chainColor: 'hsl(280 100% 70%)'
  },
  links: {
    chart: 'https://www.defined.fi/abs/0xe59a3d6f77e6d0c5daf1da740ab65adc3b674012?quoteToken=token1&cache=faf95',
    website: 'https://linktr.ee/runwithgugo?utm_source=linktree_profile_share&ltsid=2f8e530e-f1d5-4feb-8338-1d81465bcdbd',
    twitter: 'https://x.com/runwithgugo',
    community: 'https://x.com/TypeMediaX'
  },
  features: [
    'Abstract Chain (Ethereum L2)',
    'Early stage opportunity',
    'Community-driven'
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

    // Show popup after 60 seconds if not dismissed
    const timer = setTimeout(() => {
      if (!dismissed) {
        setIsOpen(true);
      }
    }, 60000);

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

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`,
      });
    }).catch(() => {
      toast({
        title: "Copy failed",
        description: "Please copy the URL manually",
        variant: "destructive"
      });
    });
  };

  const handleLinkClick = (url: string, type: string, fallbackUrl?: string, fallbackUrl2?: string) => {
    // Copy URL to clipboard as backup
    copyToClipboard(url, type);
    
    try {
      // Open URL directly in new tab
      const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
      if (newWindow) {
        toast({
          title: "Opening chart",
          description: `Redirecting to ${type}...`,
        });
      } else {
        throw new Error('Popup blocked');
      }
    } catch (error) {
      console.error('Failed to open link:', error);
      toast({
        title: "Link copied instead",
        description: `URL copied to clipboard - paste in new tab`,
      });
    }
  };

  if (!CURRENT_PROMOTION.isActive || dismissed) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleDismiss()}>
      <DialogContent className="max-w-[75vw] sm:max-w-[240px] mx-auto bg-card border border-primary/20 shadow-xl max-h-[80vh] overflow-y-auto overflow-hidden">
        {/* Animated Background */}
        <div 
          className="absolute inset-0 z-0 opacity-30"
          style={{
            backgroundImage: `url(${gugoAnimated})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        
        {/* Content Overlay */}
        <div className="relative z-10">

        <DialogHeader className="text-center space-y-1 flex flex-col items-center">
          <DialogTitle className="text-sm font-bold xr-gradient-text leading-tight text-center w-full">
            {CURRENT_PROMOTION.title}
          </DialogTitle>
          
          <div className="flex items-center justify-center gap-1.5 w-full pt-0.5">
            <Badge 
              variant="secondary" 
              className="bg-accent/60 text-accent-foreground border-accent/80 xr-glow-accent animate-glow-pulse font-bold text-[8px] px-2 py-0.5"
            >
              <Users className="h-2 w-2 mr-0.5" />
              Community
            </Badge>
            <Badge 
              variant="outline"
              style={{ borderColor: CURRENT_PROMOTION.token.chainColor, color: CURRENT_PROMOTION.token.chainColor }}
              className="xr-xray-glow animate-glow-pulse text-[8px] px-2.5 py-0.5"
            >
              {CURRENT_PROMOTION.token.chain}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-1.5 mt-2 flex flex-col items-center">
          {/* Token Info - Condensed */}
          <div className="text-center p-1.5 px-3 rounded border border-primary/30 bg-card/60 backdrop-blur-sm mx-auto w-fit">
            <div className="text-base font-bold text-primary">
              ${CURRENT_PROMOTION.token.symbol}
            </div>
            <div className="text-[9px] text-muted-foreground">
              Emerging memecoin opportunity
            </div>
          </div>

          {/* Features - Ultra Condensed */}
          <div className="text-[9px] text-muted-foreground text-center">
            Early stage • Community-driven
          </div>

          {/* Action Buttons */}
          <div className="space-y-1 pt-0.5 w-full">
            <div className="grid grid-cols-2 gap-1">
              {CURRENT_PROMOTION.links.chart && (
                <Button
                  onClick={() => handleLinkClick(
                    CURRENT_PROMOTION.links.chart!, 
                    'Defined.fi Chart'
                  )}
                  className="btn-hero text-[9px] h-6 w-full"
                >
                  <ExternalLink className="h-2.5 w-2.5 mr-1" />
                  Chart
                </Button>
              )}
              {CURRENT_PROMOTION.links.website && (
                <Button
                  variant="outline"
                  onClick={() => handleLinkClick(CURRENT_PROMOTION.links.website!, 'Abstract website')}
                  className="text-[9px] h-6 border-primary/30 hover:bg-primary/10 w-full"
                >
                  <ExternalLink className="h-2.5 w-2.5 mr-1" />
                  Learn
                </Button>
              )}
            </div>
            
            {/* Social Links */}
            <div className="grid grid-cols-2 gap-1">
              {CURRENT_PROMOTION.links.twitter && (
                <Button
                  variant="outline"
                  onClick={() => handleLinkClick(CURRENT_PROMOTION.links.twitter!, 'GUGO Twitter')}
                  className="text-[9px] h-6 border-accent/30 hover:bg-accent/10 w-full"
                >
                  <ExternalLink className="h-2.5 w-2.5 mr-1" />
                  Twitter
                </Button>
              )}
              {CURRENT_PROMOTION.links.community && (
                <Button
                  variant="outline"
                  onClick={() => handleLinkClick(CURRENT_PROMOTION.links.community!, 'Type Media Community')}
                  className="text-[9px] h-6 border-accent/30 hover:bg-accent/10 w-full"
                >
                  <ExternalLink className="h-2.5 w-2.5 mr-1" />
                  Community
                </Button>
              )}
            </div>
          </div>

          {/* Disclaimer - Condensed */}
          <div className="text-[8px] text-muted-foreground/80 text-center p-1 bg-warning/10 rounded border border-warning/20">
            ⚠️ DYOR: Not financial advice
          </div>

          {/* Quick Dismiss */}
          <div className="grid grid-cols-2 gap-1 pt-1 border-t border-border w-full">
            <Button
              onClick={() => handleDismiss(false)}
              variant="outline"
              className="text-[9px] h-6 w-full"
            >
              Close
            </Button>
            <Button
              onClick={() => handleDismiss(true)}
              variant="outline"
              className="text-[9px] h-6 w-full"
            >
              Don't show
            </Button>
          </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};