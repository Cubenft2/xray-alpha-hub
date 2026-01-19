import { ZombieDogChat } from '@/components/ZombieDogChat';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { useState, useRef } from 'react';

interface QuickAction {
  label: string;
  emoji: string;
  prompt: string;
}

const quickActions: QuickAction[] = [
  { label: 'BTC Price', emoji: '💰', prompt: 'What is the current Bitcoin price?' },
  { label: 'Top Movers', emoji: '📈', prompt: 'What are the top crypto movers today?' },
  { label: 'Trending', emoji: '🔥', prompt: 'What cryptos are trending right now?' },
  { label: 'Market Overview', emoji: '📊', prompt: 'Give me a quick market overview' },
];

const Home = () => {
  const [quickPrompt, setQuickPrompt] = useState<string | null>(null);
  const chatRef = useRef<{ sendMessage: (msg: string) => void } | null>(null);

  const handleQuickAction = (prompt: string) => {
    setQuickPrompt(prompt);
    // The chat component will pick this up
  };

  return (
    <div className="min-h-screen bg-zombiedog-pink dark:bg-background flex flex-col">
      {/* Minimal Header */}
      <header className="bg-army-green text-white p-4 shadow-lg">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <img 
              src="/zombiedog-chat-pfp.webp" 
              alt="ZombieDog" 
              className="w-10 h-10 rounded-lg pixel-border"
            />
            <span className="font-bold text-xl tracking-wide font-pixel">ZombieDog AI</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4">
        {/* Welcome Hero */}
        <div className="text-center mb-6 pt-4">
          <img 
            src="/zombiedog-chat-pfp.webp" 
            alt="ZombieDog" 
            className="w-24 h-24 mx-auto rounded-xl pixel-border shadow-xl"
          />
          <h1 className="text-2xl md:text-3xl font-bold text-dark-gray dark:text-foreground mt-4 font-pixel">
            Your Undead Market Assistant 🧟🐕
          </h1>
          <p className="text-dark-gray/70 dark:text-muted-foreground mt-2 text-sm">
            Ask me about crypto prices, market trends, or sentiment!
          </p>
        </div>

        {/* Chat Container */}
        <div className="flex-1 bg-army-green rounded-xl shadow-2xl overflow-hidden border-2 border-gold/30 min-h-[50vh]">
          <ZombieDogChat 
            isFullScreen={true} 
            className="h-full"
          />
        </div>

        {/* Quick Action Buttons */}
        <div className="flex gap-2 mt-4 justify-center flex-wrap">
          {quickActions.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              size="sm"
              onClick={() => handleQuickAction(action.prompt)}
              className="bg-white/80 dark:bg-card hover:bg-gold/20 border-army-green/30 dark:border-gold/30 text-dark-gray dark:text-foreground hover:border-gold transition-all"
            >
              <span className="mr-1">{action.emoji}</span>
              {action.label}
            </Button>
          ))}
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="text-center p-4 text-dark-gray/60 dark:text-muted-foreground text-xs bg-army-green/10 dark:bg-card/50">
        <p>ZombieDog AI • Not Financial Advice • Data from LunarCrush & Polygon</p>
      </footer>
    </div>
  );
};

export default Home;
