import React from 'react';
import { Button } from '@/components/ui/button';
import { Heart, ExternalLink } from 'lucide-react';

export function XRFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-card/50 mt-8">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
          {/* Copyright */}
          <div className="flex items-center space-x-4">
            <span className="text-sm text-muted-foreground">
              © {currentYear} XRayCrypto™
            </span>
            <a
              href="https://twitter.com/XRaycryptox"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center"
            >
              @XRaycryptox
              <ExternalLink className="w-3 h-3 ml-1" />
            </a>
          </div>

          {/* Support CTA */}
          <Button
            variant="ghost"
            size="sm"
            className="btn-accent animate-wiggle hover:animate-none"
            onClick={() => {
              // Navigate to support page
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <Heart className="w-4 h-4 mr-2 text-red-500" />
            Support XR
          </Button>
        </div>

        {/* Additional Links */}
        <div className="mt-4 pt-4 border-t border-border/50">
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
            <span>Built with ❤️ for the crypto community</span>
            <span>•</span>
            <span>Real-time data by TradingView</span>
            <span>•</span>
            <span>🐕 Woof!</span>
          </div>
        </div>
      </div>
    </footer>
  );
}