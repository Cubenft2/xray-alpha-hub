import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Heart, ExternalLink } from 'lucide-react';

export function XRFooter() {
  const currentYear = new Date().getFullYear();
  const navigate = useNavigate();

  return (
    <footer className="xr-footer mt-8">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
          {/* XRay Dog Branding */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <img 
                src="/zoobie-pfp-transparent.webp" 
                alt="Zoobie Beret Dog" 
                className="w-5 h-5 opacity-80 animate-zoobie-glow"
                loading="lazy"
              />
              <span className="text-sm text-muted-foreground font-medium">
                © {currentYear} XRayCrypto™
              </span>
            </div>
            <a
              href="https://x.com/xrayzone"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center group"
            >
              @xrayzone
              <ExternalLink className="w-3 h-3 ml-1 group-hover:animate-wiggle" />
            </a>
          </div>

          {/* XRay Dog Support CTA */}
          <Button
            variant="default"
            size="sm"
            className="bg-beret hover:bg-beret/90 text-beret-foreground animate-beret-button-glow hover:animate-none border border-beret/50"
            onClick={() => navigate('/support')}
          >
            <Heart className="w-4 h-4 mr-2 text-beret-foreground" fill="currentColor" />
            Buy Me a Treat 🦴
          </Button>
        </div>

        {/* XRay Dog Footer Message */}
        <div className="mt-4 pt-4 border-t border-border/50">
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground mb-3">
            <span className="flex items-center">
              Built with <span className="text-zoobie mx-1">💖</span> by the XRay Dog Pack 
              <img 
                src="/zoobie-pfp-transparent.webp" 
                alt="Zoobie Beret Dog" 
                className="w-4 h-4 ml-1 animate-wiggle"
                loading="lazy"
              />
            </span>
            <span className="text-zoobie/50">•</span>
            <span>Real-time data by TradingView</span>
            <span className="text-zoobie/50">•</span>
            <span className="font-bold text-beret animate-beret-text-pulse">🐕 Pixel Power • Crypto Vision • Woof!</span>
          </div>
          
          {/* Legal Links */}
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
            <a href="/about" className="text-muted-foreground hover:text-zoobie transition-colors">
              About Us
            </a>
            <span className="text-zoobie/30">•</span>
            <a href="/author/xray" className="text-muted-foreground hover:text-zoobie transition-colors">
              Author
            </a>
            <span className="text-zoobie/30">•</span>
            <a href="/terms" className="text-muted-foreground hover:text-zoobie transition-colors">
              Terms of Service
            </a>
            <span className="text-zoobie/30">•</span>
            <a href="/privacy" className="text-muted-foreground hover:text-zoobie transition-colors">
              Privacy Policy
            </a>
          </div>
          
          {/* Disclaimer */}
          <div className="mt-2 text-center">
            <p className="text-xs text-muted-foreground/80">
              ⚠️ Not financial advice • Educational content only • DYOR before investing
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}