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
  content: "Hey fren! I'm ZombieDog, your undead market assistant. Ask me about crypto prices, market trends, or sentiment!",
  timestamp: new Date(),
};

// Hardcoded Supabase constants (env vars not available in this context)
const SUPABASE_URL = "https://odncvfiuzliyohxrsigc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ";
const CHAT_URL = `${SUPABASE_URL}/functions/v1/zombiedog-chat`;

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
      'Authorization': `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
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
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          onDelta(parsed.delta.text);
        }
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        textBuffer = line + '\n' + textBuffer;
        break;
      }
    }
  }

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
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          onDelta(parsed.delta.text);
        }
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch { /* ignore */ }
    }
  }

  onDone();
}

interface ZombieDogChatProps {
  compact?: boolean;
  className?: string;
}

export const ZombieDogChat = ({ compact = false, className = '' }: ZombieDogChatProps) => {
  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

    const apiMessages: Msg[] = [...messages, userMessage]
      .filter(m => m.id !== '1')
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
          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `Woof! Something went wrong... ${error}. Try again!`,
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
    <div className={`flex flex-col ${className}`}>
      {/* Messages Area */}
      <div 
        className={`flex-1 overflow-y-auto p-3 relative ${compact ? 'min-h-0' : 'min-h-[300px]'}`}
      >
        {/* Animated zombie watermark with spooky glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <img 
            src="/zombiechat-bg.png" 
            alt="" 
            className="w-[95%] h-[95%] object-contain opacity-25 animate-ghost-float"
            style={{
              filter: 'drop-shadow(0 0 15px hsl(120 100% 35% / 0.6)) drop-shadow(0 0 30px hsl(120 100% 35% / 0.3))'
            }}
          />
        </div>
        {/* Semi-transparent overlay for readability */}
        <div className="absolute inset-0 bg-card/70 pointer-events-none" />
        
        {/* Messages content */}
        <div className="relative z-10 space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && (
              <img src="/zombiedog-chat-pfp.webp" alt="ZombieDog" className="w-6 h-6 mr-2 flex-shrink-0 pixel-border object-cover rounded-sm" />
            )}
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 ${
                message.role === 'user'
                  ? 'bg-muted/80 text-foreground'
                  : 'bg-primary/20 border border-primary/30 text-foreground'
              }`}
            >
              <p className="text-xs whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex justify-start">
            <img src="/zombiedog-chat-pfp.webp" alt="ZombieDog thinking" className="w-6 h-6 mr-2 flex-shrink-0 pixel-border object-cover rounded-sm animate-pulse" />
            <div className="bg-primary/20 border border-primary/30 rounded-lg px-3 py-2">
              <p className="text-xs text-muted-foreground animate-pulse">
                Sniffing the data...
              </p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-primary/20 p-2 bg-card/50">
        <div className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask ZombieDog..."
            className="flex-1 h-8 text-xs bg-background/50 border-primary/30 focus:border-primary"
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="sm"
            className="btn-hero h-8 px-3"
          >
            <Send className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
};
