import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const welcomeMessage: Message = {
  id: '1',
  role: 'assistant',
  content: "Hey fren! 🧟🐕 I'm ZombieDog, your undead market assistant. Ask me about crypto prices, market trends, or sentiment. What do you want to know?",
  timestamp: new Date(),
};

const ZombieDog = () => {
  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    document.title = 'ZombieDog AI | XRayCrypto™';
    return () => { document.title = 'XRayCrypto™'; };
  }, []);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const userInput = input.trim();
    setInput('');
    setIsLoading(true);

    // Simulate response delay
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Woof! I heard you ask about "${userInput}". My brain is still being connected… check back soon! 🧟‍♂️`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6 max-w-3xl">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              {/* Placeholder for ZombieDog NFT image */}
              <div className="w-24 h-24 bg-card border-2 border-primary/50 pixel-border flex items-center justify-center text-4xl animate-ghost-float">
                🧟🐕
              </div>
            </div>
            <h1 className="text-3xl md:text-4xl xr-pixel-title text-primary mb-2">
              Ask ZombieDog
            </h1>
            <p className="text-muted-foreground font-mono text-sm">
              Your AI Market Assistant
            </p>
          </div>

          {/* Chat Container */}
          <div className="xr-card border border-primary/20 rounded-lg overflow-hidden">
            {/* Messages Area */}
            <div className="h-[calc(100vh-380px)] min-h-[300px] overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && (
                    <div className="w-8 h-8 mr-3 flex-shrink-0 bg-card border border-primary/30 pixel-border flex items-center justify-center text-sm">
                      🧟
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] md:max-w-[70%] rounded-lg px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-muted/80 text-foreground'
                        : 'bg-primary/20 border border-primary/30 text-foreground'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}

              {/* Loading State */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="w-8 h-8 mr-3 flex-shrink-0 bg-card border border-primary/30 pixel-border flex items-center justify-center text-sm animate-pulse">
                    🧟
                  </div>
                  <div className="bg-primary/20 border border-primary/30 rounded-lg px-4 py-3">
                    <p className="text-sm text-muted-foreground animate-pulse">
                      ZombieDog is sniffing the data… 🐕👃
                    </p>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-primary/20 p-4 bg-card/50">
              <div className="flex items-center gap-3">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask ZombieDog anything about crypto..."
                  className="flex-1 bg-background/50 border-primary/30 focus:border-primary"
                  disabled={isLoading}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="btn-hero px-4"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <p className="text-center text-xs text-muted-foreground mt-4 font-mono">
            ZombieDog AI is powered by XRayCrypto™ • Not financial advice
          </p>
      </div>
    </div>
  );
};

export default ZombieDog;
