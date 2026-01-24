import { X } from "lucide-react";
import { Button } from "./ui/button";
import { useEffect } from "react";

interface NewsAlertBannerProps {
  count: number;
  latestHeadline: string;
  onClose: () => void;
  onViewNews: () => void;
}

export function NewsAlertBanner({ count, latestHeadline, onClose, onViewNews }: NewsAlertBannerProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 10000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="animate-slide-in-down mb-4 overflow-hidden rounded-lg bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 bg-[length:200%_100%] animate-gradient shadow-lg">
      <div className="backdrop-blur-sm bg-black/20 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <span className="text-2xl animate-pulse flex-shrink-0">🔔</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-bold text-white text-sm uppercase tracking-wide">
                  Fresh from Polygon.io
                </p>
                <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs text-white font-medium">
                  Live
                </span>
              </div>
              <p className="text-white/90 text-sm mb-2">
                {count} new article{count !== 1 ? 's' : ''} just dropped
              </p>
              {latestHeadline && (
                <p className="text-white/80 text-xs line-clamp-2 mb-2">
                  Latest: {latestHeadline}
                </p>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={onViewNews}
                className="bg-white/20 hover:bg-white/30 text-white border-white/30 text-xs h-7"
              >
                View News →
              </Button>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/20 flex-shrink-0 h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
