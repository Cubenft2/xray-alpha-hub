import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';
import { toast } from 'sonner';

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

const CHAT_URL = `https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/zombiedog-chat`;

type Msg = { role: 'user' | 'assistant'; content: string };

async function streamChat({
  messages,
  onDelta,
  onDone,
  onError,
}: {
  messages: Msg[];
  onDelta: (deltaText: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}) {
  const resp = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ`,
    },
    body: JSON.stringify({ messages }),
  });

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({ error: 'Unknown error' }));
    onError(errorData.error || `Error: ${resp.status}`);
    return;
  }

  if (!resp.body) {
    onError('No response body');
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = '';
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);

      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (line.startsWith(':') || line.trim() === '') continue;
      if (!line.startsWith('data: ')) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === '[DONE]') {
        streamDone = true;
        break;
      }

      try {
        const parsed = JSON.parse(jsonStr);
        // Handle Anthropic's streaming format
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          onDelta(parsed.delta.text);
        }
        // Also handle OpenAI format as fallback
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        textBuffer = line + '\n' + textBuffer;
        break;
      }
    }
  }

  // Final flush
  if (textBuffer.trim()) {
    for (let raw of textBuffer.split('\n')) {
      if (!raw) continue;
      if (raw.endsWith('\r')) raw = raw.slice(0, -1);
      if (raw.startsWith(':') || raw.trim() === '') continue;
      if (!raw.startsWith('data: ')) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === '[DONE]') continue;
      try {
        const parsed = JSON.parse(jsonStr);
        // Handle Anthropic's streaming format
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          onDelta(parsed.delta.text);
        }
        // Also handle OpenAI format as fallback
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch { /* ignore */ }
    }
  }

  onDone();
}

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

  const handleSend = async () => {
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

    // Prepare messages for API (exclude welcome message, use only user/assistant content)
    const apiMessages: Msg[] = [...messages, userMessage]
      .filter(m => m.id !== '1') // exclude welcome
      .map(m => ({ role: m.role, content: m.content }));

    let assistantSoFar = '';
    
    const upsertAssistant = (nextChunk: string) => {
      assistantSoFar += nextChunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && last.id !== '1') {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { 
          id: (Date.now() + 1).toString(), 
          role: 'assistant' as const, 
          content: assistantSoFar,
          timestamp: new Date(),
        }];
      });
    };

    try {
      await streamChat({
        messages: apiMessages,
        onDelta: (chunk) => upsertAssistant(chunk),
        onDone: () => setIsLoading(false),
        onError: (error) => {
          toast.error(error);
          setIsLoading(false);
          // Add error message from ZombieDog
          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `Woof! 🧟 Something went wrong with my brain connection... ${error}. Try again in a moment!`,
            timestamp: new Date(),
          }]);
        },
      });
    } catch (e) {
      console.error('Stream error:', e);
      toast.error('Failed to connect to ZombieDog');
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div className="relative">
      {/* Zombie pattern background - contained within this component */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: 'url("/zombiedog-bg.png")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 z-0 bg-background/80 dark:bg-background/85 pointer-events-none" />
      
      {/* Chat container with explicit height */}
      <div className="relative z-10 flex flex-col">
        {/* Minimal header bar */}
        <div className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-3 border-b border-primary/20 bg-card/50 backdrop-blur-sm">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-card border-2 border-primary/50 pixel-border flex items-center justify-center text-base sm:text-xl animate-ghost-float flex-shrink-0">
            🧟🐕
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl xr-pixel-title text-primary truncate">
              ZombieDog
            </h1>
            <p className="hidden sm:block text-xs text-muted-foreground font-mono">
              Your AI Market Assistant
            </p>
          </div>
        </div>

        {/* Messages Area - Explicit height to account for Layout header/tickers/footer */}
        <div className="h-[calc(100vh-320px)] sm:h-[calc(100vh-380px)] min-h-[300px] overflow-y-auto p-3 sm:p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div className="w-8 h-8 mr-2 sm:mr-3 flex-shrink-0 bg-card border border-primary/30 pixel-border flex items-center justify-center text-sm">
                  🧟
                </div>
              )}
              <div
                className={`max-w-[85%] sm:max-w-[80%] md:max-w-[70%] rounded-lg px-3 py-2 sm:px-4 sm:py-3 ${
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
          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex justify-start">
              <div className="w-8 h-8 mr-2 sm:mr-3 flex-shrink-0 bg-card border border-primary/30 pixel-border flex items-center justify-center text-sm animate-pulse">
                🧟
              </div>
              <div className="bg-primary/20 border border-primary/30 rounded-lg px-3 py-2 sm:px-4 sm:py-3">
                <p className="text-sm text-muted-foreground animate-pulse">
                  ZombieDog is sniffing the data… 🐕👃
                </p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area - Pinned at bottom */}
        <div className="border-t border-primary/20 p-3 sm:p-4 bg-card/50 backdrop-blur-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask ZombieDog..."
              className="flex-1 bg-background/50 border-primary/30 focus:border-primary text-sm"
              disabled={isLoading}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="btn-hero px-3 sm:px-4"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZombieDog;
