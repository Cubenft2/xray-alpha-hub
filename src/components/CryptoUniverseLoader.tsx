import { Moon } from 'lucide-react';

export function CryptoUniverseLoader() {
  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-6">
      {/* Animated Moon Icon */}
      <div className="relative">
        <Moon className="h-16 w-16 text-primary animate-pulse" />
        <div className="absolute inset-0 h-16 w-16 rounded-full bg-primary/20 animate-ping" />
      </div>

      {/* Loading Text */}
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-foreground">
          Loading Crypto Universe...
        </h2>
        <p className="text-sm text-muted-foreground">
          Fetching data for 3000+ tokens
        </p>
      </div>

      {/* Animated Progress Bar */}
      <div className="w-64 h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary rounded-full animate-[loading_1.5s_ease-in-out_infinite]"
          style={{
            width: '40%',
            animation: 'loading 1.5s ease-in-out infinite'
          }}
        />
      </div>

      {/* Bouncing Dots */}
      <div className="flex space-x-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-2 w-2 bg-primary rounded-full"
            style={{
              animation: `bounce 1s ease-in-out ${i * 0.15}s infinite`
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(150%); }
          100% { transform: translateX(-100%); }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50% { transform: translateY(-8px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
