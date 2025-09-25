import React from 'react';

interface XRayDogProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

export function XRayDog({ className = '', size = 'md', animated = true }: XRayDogProps) {
  const sizeClasses = {
    sm: 'w-16 h-12',
    md: 'w-24 h-18',
    lg: 'w-32 h-24'
  };

  const headSize = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8', 
    lg: 'w-12 h-12'
  };

  return (
    <div className={`relative ${sizeClasses[size]} ${className}`}>
      {/* Dog Body */}
      <div className="absolute inset-0 flex items-center justify-center">
        
        {/* Tail */}
        <div className={`absolute -right-2 top-1 ${animated ? 'animate-wiggle' : ''}`}>
          <div className="w-4 h-1 bg-gradient-to-r from-primary/60 to-primary/40 rounded-full transform rotate-12 origin-left"></div>
          <div className="w-3 h-1 bg-gradient-to-r from-primary/40 to-primary/20 rounded-full transform rotate-25 origin-left mt-0.5 ml-3"></div>
        </div>

        {/* Main Body */}
        <div className="relative">
          {/* Body Torso */}
          <div className="w-12 h-6 bg-gradient-to-b from-primary/50 to-primary/70 rounded-full relative">
            
            {/* Chest */}
            <div className="absolute top-1 left-1 w-3 h-3 bg-gradient-to-br from-accent/30 to-accent/50 rounded-full"></div>
            
            {/* Body Pattern */}
            <div className="absolute top-2 left-2 w-2 h-1 bg-primary/80 rounded-full"></div>
            <div className="absolute top-3 left-3 w-1.5 h-0.5 bg-primary/60 rounded-full"></div>
          </div>

          {/* Front Legs */}
          <div className="absolute -bottom-3 left-1 flex space-x-1">
            <div className={`w-1 h-4 bg-gradient-to-b from-primary/60 to-primary/80 rounded-full ${animated ? 'animate-pulse' : ''}`}></div>
            <div className={`w-1 h-4 bg-gradient-to-b from-primary/60 to-primary/80 rounded-full ${animated ? 'animate-pulse' : ''}`} style={{ animationDelay: '0.5s' }}></div>
          </div>

          {/* Back Legs */}
          <div className="absolute -bottom-3 right-1 flex space-x-1">
            <div className={`w-1 h-4 bg-gradient-to-b from-primary/60 to-primary/80 rounded-full ${animated ? 'animate-pulse' : ''}`} style={{ animationDelay: '0.25s' }}></div>
            <div className={`w-1 h-4 bg-gradient-to-b from-primary/60 to-primary/80 rounded-full ${animated ? 'animate-pulse' : ''}`} style={{ animationDelay: '0.75s' }}></div>
          </div>

          {/* Paws */}
          <div className="absolute -bottom-2 left-0.5">
            <div className="w-1.5 h-1 bg-primary/90 rounded-full"></div>
            <div className="w-1.5 h-1 bg-primary/90 rounded-full ml-1"></div>
          </div>
          <div className="absolute -bottom-2 right-0.5">
            <div className="w-1.5 h-1 bg-primary/90 rounded-full"></div>
            <div className="w-1.5 h-1 bg-primary/90 rounded-full ml-1"></div>
          </div>

          {/* Neck */}
          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
            <div className="w-3 h-3 bg-gradient-to-t from-primary/70 to-primary/40 rounded-full"></div>
          </div>

          {/* Head (Your PFP) */}
          <div className={`absolute -top-6 left-1/2 transform -translate-x-1/2 ${animated ? 'animate-bounce' : ''}`} style={{ animationDuration: '3s' }}>
            <div className={`${headSize[size]} relative`}>
              <img 
                src="/pfp.png" 
                alt="XRay Dog Head" 
                className={`${headSize[size]} rounded-full border-2 border-primary/30 shadow-lg`}
              />
              
              {/* XRay Glow Effect around head */}
              <div className={`absolute inset-0 ${headSize[size]} rounded-full animate-pulse`} 
                   style={{ 
                     boxShadow: '0 0 10px hsl(var(--primary) / 0.3), 0 0 20px hsl(var(--primary) / 0.2), 0 0 30px hsl(var(--primary) / 0.1)' 
                   }}>
              </div>

              {/* Eyes Glow */}
              {animated && (
                <>
                  <div className="absolute top-2 left-1.5 w-0.5 h-0.5 bg-accent rounded-full animate-ping"></div>
                  <div className="absolute top-2 right-1.5 w-0.5 h-0.5 bg-accent rounded-full animate-ping" style={{ animationDelay: '0.5s' }}></div>
                </>
              )}
            </div>
          </div>

          {/* XRay Energy Lines */}
          {animated && (
            <>
              <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-primary/40 to-transparent animate-pulse"></div>
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-primary/40 to-transparent animate-pulse" style={{ animationDelay: '1s' }}></div>
              <div className="absolute top-0 left-0 w-0.5 h-full bg-gradient-to-b from-transparent via-primary/40 to-transparent animate-pulse" style={{ animationDelay: '0.5s' }}></div>
              <div className="absolute top-0 right-0 w-0.5 h-full bg-gradient-to-b from-transparent via-primary/40 to-transparent animate-pulse" style={{ animationDelay: '1.5s' }}></div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}