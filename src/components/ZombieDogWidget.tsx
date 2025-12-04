import React, { useState } from 'react';
import { X, Minus } from 'lucide-react';
import { ZombieDogChat } from './ZombieDogChat';

export const ZombieDogWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const toggleOpen = () => {
    if (isMinimized) {
      setIsMinimized(false);
    } else {
      setIsOpen(!isOpen);
    }
  };

  const handleMinimize = () => {
    setIsMinimized(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsMinimized(false);
  };

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
          <span className="text-xl">🧟</span>
          <span>ZombieChat</span>
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && !isMinimized && (
        <div 
          className="fixed bottom-4 right-4 z-50 w-[340px] sm:w-[380px] h-[480px] bg-card border-2 border-primary/50 rounded-lg shadow-2xl flex flex-col overflow-hidden animate-scale-in"
          style={{ 
            boxShadow: '0 0 30px hsl(var(--primary) / 0.3)',
          }}
        >
          {/* Header */}
          <div 
            className="flex items-center justify-between px-3 py-2 border-b"
            style={{
              backgroundColor: '#5a6b4a',
              borderColor: '#4a6b4a',
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">🧟</span>
              <span className="font-mono text-sm font-bold" style={{ color: '#e8e0c8' }}>ZombieChat</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleMinimize}
                className="p-1 hover:bg-primary/20 rounded transition-colors"
                aria-label="Minimize chat"
              >
                <Minus className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </button>
              <button
                onClick={handleClose}
                className="p-1 hover:bg-destructive/20 rounded transition-colors"
                aria-label="Close chat"
              >
                <X className="w-4 h-4 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          </div>

          {/* Chat Content */}
          <ZombieDogChat compact className="flex-1 min-h-0" />

          {/* Footer */}
          <div className="px-2 py-1 bg-card/80 border-t border-primary/20">
            <p className="text-[10px] text-center text-muted-foreground font-mono">
              Powered by XRayCrypto™ • Not financial advice
            </p>
          </div>
        </div>
      )}
    </>
  );
};
