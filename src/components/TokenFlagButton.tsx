import React, { useState } from 'react';
import { Flag, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useTokenFlags, FLAG_CATEGORIES, TokenFlagCategory } from '@/hooks/useTokenFlags';
import { cn } from '@/lib/utils';

interface TokenFlagButtonProps {
  symbol: string;
  compact?: boolean;
}

export function TokenFlagButton({ symbol, compact = false }: TokenFlagButtonProps) {
  const { isAdmin, addFlag, removeFlag, getFlagsForSymbol, isAddingFlag } = useTokenFlags();
  const [open, setOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<TokenFlagCategory | null>(null);
  const [notes, setNotes] = useState('');

  if (!isAdmin) return null;

  const existingFlags = getFlagsForSymbol(symbol);
  const hasFlags = existingFlags.length > 0;

  const handleAddFlag = () => {
    if (!selectedCategory) return;
    addFlag({ symbol, category: selectedCategory, notes: notes || undefined });
    setSelectedCategory(null);
    setNotes('');
    setOpen(false);
  };

  const handleRemoveFlag = (flagId: string) => {
    removeFlag(flagId);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? "icon" : "sm"}
          className={cn(
            "relative",
            hasFlags && "text-yellow-500 hover:text-yellow-600"
          )}
        >
          <Flag className={cn("h-4 w-4", !compact && "mr-1")} />
          {!compact && "Flag"}
          {hasFlags && (
            <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-xs rounded-full h-4 w-4 flex items-center justify-center">
              {existingFlags.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="font-medium text-sm">Flag: {symbol}</div>
          
          {/* Existing flags */}
          {existingFlags.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Current flags:</div>
              {existingFlags.map((flag) => {
                const cat = FLAG_CATEGORIES.find(c => c.value === flag.category);
                return (
                  <div key={flag.id} className="flex items-center justify-between bg-muted/50 rounded p-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn("text-xs", cat?.color, "text-white")}>
                        {cat?.label}
                      </Badge>
                      {flag.notes && (
                        <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                          {flag.notes}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleRemoveFlag(flag.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add new flag */}
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">Add flag:</div>
            <div className="flex flex-wrap gap-1">
              {FLAG_CATEGORIES.map((cat) => {
                const alreadyHas = existingFlags.some(f => f.category === cat.value);
                return (
                  <Badge
                    key={cat.value}
                    variant={selectedCategory === cat.value ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer text-xs transition-all",
                      selectedCategory === cat.value && cn(cat.color, "text-white"),
                      alreadyHas && "opacity-50 cursor-not-allowed"
                    )}
                    onClick={() => !alreadyHas && setSelectedCategory(
                      selectedCategory === cat.value ? null : cat.value
                    )}
                  >
                    {cat.label}
                  </Badge>
                );
              })}
            </div>
            
            {selectedCategory && (
              <>
                <Textarea
                  placeholder="Notes (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="text-sm h-20"
                />
                <Button 
                  size="sm" 
                  className="w-full" 
                  onClick={handleAddFlag}
                  disabled={isAddingFlag}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Add Flag
                </Button>
              </>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
