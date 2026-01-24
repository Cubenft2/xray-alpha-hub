import React, { useState, useEffect } from 'react';
import { X, Minus, Maximize2, Minimize2 } from 'lucide-react';
import { ZombieDogChat } from './ZombieDogChat';
import { cn } from '@/lib/utils';

export const ZombieDogWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const toggleOpen = () => {
    if (isMinimized) {
      setIsMinimized(false);
    } else {
      setIsOpen(!isOpen);
    }
  };

  const handleMinimize = () => {
    setIsMinimized(true);
    setIsFullScreen(false);
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsMinimized(false);
    setIsFullScreen(false);
  };

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  // Handle escape key to exit full-screen
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
      }
    };
    
    if (isFullScreen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll in full-screen
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isFullScreen]);

  return (
    <>
      {/* Floating Bubble Button */}
      {(!isOpen || isMinimized) && (
        <button
          onClick={toggleOpen}
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg pixel-border shadow-lg animate-ghost-float transition-all duration-300 hover:scale-105 font-mono text-sm font-bold border-2"
          style={{
            backgroundColor: '#5a6b4a',
            borderColor: '#4a6b4a',
            color: '#e8e0c8',
            boxShadow: '0 4px 15px rgba(126, 207, 183, 0.3)',
          }}
          aria-label="Open ZombieChat"
        >
          <img src="/zombiedog-chat-pfp.webp" alt="ZombieDog" className="w-6 h-6 pixel-border object-cover rounded-sm" />
          <span>ZombieChat</span>
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && !isMinimized && (
        <div 
          className={cn(
            "fixed z-50 bg-card border-2 border-primary/50 flex flex-col overflow-hidden transition-all duration-300 ease-in-out",
            isFullScreen 
              ? "inset-0 rounded-none animate-fade-in" 
              : "bottom-4 right-4 w-[340px] sm:w-[380px] h-[480px] rounded-lg shadow-2xl animate-scale-in"
          )}
          style={{ 
            boxShadow: isFullScreen ? 'none' : '0 0 30px hsl(var(--primary) / 0.3)',
          }}
        >
          {/* Header */}
          <div 
            className={cn(
              "flex items-center justify-between border-b",
              isFullScreen ? "px-4 py-3" : "px-3 py-2"
            )}
            style={{
              backgroundColor: '#ffc8e8',
              borderColor: '#ffb0d8',
            }}
          >
            <div className="flex items-center gap-2">
              <img 
                src="/zombiedog-chat-pfp.webp" 
                alt="ZombieDog" 
                className={cn(
                  "object-cover",
                  isFullScreen ? "w-8 h-8" : "w-6 h-6"
                )} 
              />
              <span 
                className={cn(
                  "font-mono font-bold",
                  isFullScreen ? "text-base" : "text-sm"
                )} 
                style={{ color: '#4a4a4a' }}
              >
                ZombieChat
              </span>
              {isFullScreen && (
                <span className="text-xs text-muted-foreground ml-2">(Press ESC to exit)</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {/* Toggle Full Screen */}
              <button
                onClick={toggleFullScreen}
                className="p-1.5 hover:bg-primary/20 rounded transition-colors"
                aria-label={isFullScreen ? "Exit full screen" : "Full screen"}
                title={isFullScreen ? "Exit full screen" : "Full screen"}
              >
                {isFullScreen ? (
                  <Minimize2 className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                ) : (
                  <Maximize2 className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                )}
              </button>
              {/* Minimize */}
              <button
                onClick={handleMinimize}
                className="p-1.5 hover:bg-primary/20 rounded transition-colors"
                aria-label="Minimize chat"
              >
                <Minus className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </button>
              {/* Close */}
              <button
                onClick={handleClose}
                className="p-1.5 hover:bg-destructive/20 rounded transition-colors"
                aria-label="Close chat"
              >
                <X className="w-4 h-4 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          </div>

          {/* Chat Content */}
          <ZombieDogChat 
            compact 
            isFullScreen={isFullScreen}
            className="flex-1 min-h-0" 
          />

          {/* Footer */}
          <div className={cn(
            "bg-card/80 border-t border-primary/20",
            isFullScreen ? "px-4 py-2" : "px-2 py-1"
          )}>
            <p className={cn(
              "text-center text-muted-foreground font-mono",
              isFullScreen ? "text-xs" : "text-[10px]"
            )}>
              Powered by XRayCrypto™ • Not financial advice
            </p>
          </div>
        </div>
      )}
    </>
  );
};
