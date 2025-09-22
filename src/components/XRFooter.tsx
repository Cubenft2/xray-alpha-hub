import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Heart, ExternalLink } from 'lucide-react';

export function XRFooter() {
  const currentYear = new Date().getFullYear();
  const navigate = useNavigate();

  return (
    <footer className="border-t border-border bg-card/50 mt-8">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
          {/* XRay Dog Branding */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <img 
                src="/xray-dog.png" 
                alt="XRay Dog Mascot" 
                className="w-5 h-5 opacity-80" 
                style={{ imageRendering: 'pixelated' }}
              />
              <span className="text-sm text-muted-foreground font-medium">
                © {currentYear} XRayCrypto™
              </span>
            </div>
            <a
              href="https://twitter.com/XRaycryptox"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center group"
            >
              @XRaycryptox
              <ExternalLink className="w-3 h-3 ml-1 group-hover:animate-wiggle" />
            </a>
          </div>

          {/* XRay Dog Support CTA */}
          <Button
            variant="default"
            size="sm"
            className="animate-wiggle hover:animate-none"
            onClick={() => navigate('/support')}
          >
            <Heart className="w-4 h-4 mr-2 text-red-500" />
            Buy Me a Treat 🦴
          </Button>
        </div>

        {/* XRay Dog Footer Message */}
        <div className="mt-4 pt-4 border-t border-border/50">
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center">
              Built with 💖 by the XRay Dog Pack 
              <img 
                src="/xray-dog.png" 
                alt="XRay Dog" 
                className="w-4 h-4 ml-1 animate-wiggle" 
                style={{ imageRendering: 'pixelated' }}
              />
            </span>
            <span>•</span>
            <span>Real-time data by TradingView</span>
            <span>•</span>
            <span className="font-bold text-accent">🐕 Pixel Power • Crypto Vision • Woof!</span>
          </div>
        </div>
      </div>
    </footer>
  );
}