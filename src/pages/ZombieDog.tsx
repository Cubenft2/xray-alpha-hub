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
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
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
