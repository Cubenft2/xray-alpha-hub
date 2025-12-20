import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Trash2, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const CHAT_STORAGE_KEY = 'zombiedog-chat-history';
const SESSION_ID_KEY = 'zombiedog-session-id';
const DAILY_MESSAGE_LIMIT = 10;

// FIX #3: Generate persistent session ID (UUID in localStorage)
function getOrCreateSessionId(): string {
  let sessionId = localStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_ID_KEY, sessionId);
  }
  return sessionId;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const welcomeMessage: Message = {
  id: '1',
  role: 'assistant',
  content: "Hey fren! 🧟🐕 I'm ZombieDog, your undead market assistant!\n\n🌍 I speak your language! 🇺🇸 🇪🇸 🇫🇷 🇧🇷 🇩🇪 🇯🇵 🇰🇷 🇨🇳\n\nAsk me about crypto prices, market trends, or sentiment!",
  timestamp: new Date(),
};

// Hardcoded Supabase constants (env vars not available in this context)
const SUPABASE_URL = "https://odncvfiuzliyohxrsigc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ";
const CHAT_URL = `${SUPABASE_URL}/functions/v1/zombiedog-agent`;

// Fetch usage count from backend
async function fetchUsageCount(): Promise<{ remaining: number; isAdmin: boolean }> {
  try {
    // Get auth token if user is logged in
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_PUBLISHABLE_KEY,
    };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    
    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action: 'get_usage' }),
    });
    
    if (resp.ok) {
      const data = await resp.json();
      return { 
        remaining: data.isAdmin ? -1 : data.remaining, 
        isAdmin: data.isAdmin || false 
      };
    }
  } catch (e) {
    console.warn('Failed to fetch usage count:', e);
  }
  return { remaining: DAILY_MESSAGE_LIMIT, isAdmin: false };
}

type Msg = { role: 'user' | 'assistant'; content: string };

async function streamChat({
  messages,
  onDelta,
  onDone,
  onError,
  onRateLimited,
}: {
  messages: Msg[];
  onDelta: (deltaText: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
  onRateLimited: () => void;
}) {
  // Get auth token if user is logged in (for admin bypass)
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_PUBLISHABLE_KEY,
  };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  
  // FIX #3: Include client session_id for persistent memory
  const resp = await fetch(CHAT_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages, session_id: getOrCreateSessionId() }),
  });

  // Handle rate limiting
  if (resp.status === 429) {
    onRateLimited();
    return;
  }

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
  isFullScreen?: boolean;
  className?: string;
}

export const ZombieDogChat = ({ compact = false, isFullScreen = false, className = '' }: ZombieDogChatProps) => {
  // Load messages from localStorage on mount
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const stored = localStorage.getItem(CHAT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Restore Date objects from strings
        return parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }));
      }
    } catch (e) {
      console.warn('Failed to load chat history:', e);
    }
    return [welcomeMessage];
  });
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [remainingMessages, setRemainingMessages] = useState<number>(DAILY_MESSAGE_LIMIT);
  const [isAdmin, setIsAdmin] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isLimitReached = !isAdmin && remainingMessages <= 0;

  // Fetch usage count from server on mount
  useEffect(() => {
    fetchUsageCount().then(({ remaining, isAdmin: admin }) => {
      setRemainingMessages(remaining);
      setIsAdmin(admin);
    });
  }, []);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
      console.warn('Failed to save chat history:', e);
    }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const clearChat = useCallback(() => {
    localStorage.removeItem(CHAT_STORAGE_KEY);
    setMessages([{ ...welcomeMessage, timestamp: new Date() }]);
    toast.success('Chat history cleared');
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading || isLimitReached) return;

    // Show warning when approaching limit (non-admin only)
    if (!isAdmin && remainingMessages === 3) {
      toast.warning('🐕 3 messages left today!');
    }

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
        onDone: () => {
          setIsLoading(false);
          // Refresh usage count after successful message
          if (!isAdmin) {
            setRemainingMessages(prev => Math.max(0, prev - 1));
          }
        },
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
        onRateLimited: () => {
          setIsLoading(false);
          setRemainingMessages(0);
          toast.error('Daily message limit reached! Resets at midnight ET.');
          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: "🚫 Woof! You've reached your daily limit of 10 messages. Come back tomorrow at midnight ET for more market insights!",
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

  // Dynamic sizing based on full-screen mode
  const textSize = isFullScreen ? 'text-sm' : 'text-xs';
  const avatarSize = isFullScreen ? 'w-8 h-8' : 'w-6 h-6';
  const inputHeight = isFullScreen ? 'h-10' : 'h-8';
  const inputTextSize = isFullScreen ? 'text-sm' : 'text-xs';
  const padding = isFullScreen ? 'p-4' : 'p-3';
  const messageSpacing = isFullScreen ? 'space-y-4' : 'space-y-3';
  const messagePadding = isFullScreen ? 'px-4 py-3' : 'px-3 py-2';

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Messages Area */}
      <div 
        className={`flex-1 overflow-y-auto ${padding} relative ${compact ? 'min-h-0' : 'min-h-[300px]'}`}
      >
        {/* Animated zombie watermark with spooky glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <img 
            src="/zoobie-pfp-transparent.webp" 
            alt="" 
            className="w-[95%] h-[95%] object-contain opacity-25 animate-ghost-float"
            loading="lazy"
            style={{
              filter: 'drop-shadow(0 0 15px hsl(120 100% 35% / 0.6)) drop-shadow(0 0 30px hsl(120 100% 35% / 0.3))'
            }}
          />
        </div>
        {/* Semi-transparent overlay for readability */}
        <div className="absolute inset-0 bg-card/70 pointer-events-none" />
        
        {/* Messages content */}
        <div className={`relative z-10 ${messageSpacing}`}>
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && (
              <img 
                src="/zombiedog-chat-pfp.webp" 
                alt="ZombieDog" 
                className={`${avatarSize} mr-2 flex-shrink-0 pixel-border object-cover rounded-sm`} 
              />
            )}
            <div
              className={`max-w-[85%] rounded-lg ${messagePadding} ${
                message.role === 'user'
                  ? 'bg-muted/80 text-foreground'
                  : 'bg-[hsl(120_100%_35%/0.15)] border border-[hsl(120_100%_35%/0.3)] text-foreground'
              }`}
            >
              <p className={`${textSize} whitespace-pre-wrap`}>{message.content}</p>
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex justify-start">
            <img 
              src="/zombiedog-chat-pfp.webp" 
              alt="ZombieDog thinking" 
              className={`${avatarSize} mr-2 flex-shrink-0 pixel-border object-cover rounded-sm animate-pulse`} 
            />
            <div className={`bg-[hsl(120_100%_35%/0.15)] border border-[hsl(120_100%_35%/0.3)] rounded-lg ${messagePadding}`}>
              <p className={`${textSize} text-muted-foreground animate-pulse`}>
                Sniffing the data...
              </p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className={`border-t border-primary/20 ${isFullScreen ? 'p-3' : 'p-2'} bg-card/50`}>
        {/* Message counter - hide for admins */}
        {!isAdmin && remainingMessages < DAILY_MESSAGE_LIMIT && remainingMessages >= 0 && (
          <div className={`flex items-center justify-center gap-1 mb-2 ${remainingMessages <= 3 ? 'text-destructive' : 'text-muted-foreground'}`}>
            <MessageCircle className="w-3 h-3" />
            <span className="text-xs font-medium">
              {remainingMessages > 0 ? `${remainingMessages}/${DAILY_MESSAGE_LIMIT} messages remaining today` : 'Daily limit reached'}
            </span>
          </div>
        )}
        
        {isLimitReached ? (
          <div className="text-center py-2">
            <p className="text-xs text-muted-foreground mb-2">
              🧟 Woof! You've reached your daily limit of {DAILY_MESSAGE_LIMIT} messages.
            </p>
            <p className="text-xs text-muted-foreground">
              Resets at midnight ET. Clear chat history if you want a fresh start:
            </p>
            <Button
              onClick={clearChat}
              variant="outline"
              size="sm"
              className="mt-2 border-primary/50 hover:bg-primary/20"
            >
              <Trash2 className="w-3 h-3 mr-1" /> Clear Chat History
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              onClick={clearChat}
              variant="ghost"
              size="sm"
              className={`${isFullScreen ? 'h-10 w-10' : 'h-8 w-8'} p-0 text-muted-foreground hover:text-destructive`}
              title="Clear chat history"
            >
              <Trash2 className={isFullScreen ? "w-4 h-4" : "w-3 h-3"} />
            </Button>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask ZombieDog anything (any language!)..."
              className={`flex-1 ${inputHeight} ${inputTextSize} bg-background/50 border-primary/30 focus:border-primary`}
              disabled={isLoading}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              size={isFullScreen ? "default" : "sm"}
              className={`btn-hero ${isFullScreen ? 'h-10 px-4' : 'h-8 px-3'}`}
            >
              <Send className={isFullScreen ? "w-4 h-4" : "w-3 h-3"} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};