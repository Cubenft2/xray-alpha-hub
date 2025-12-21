import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type TokenFlagCategory = 'needs_work' | 'remove' | 'review' | 'suspicious' | 'duplicate' | 'missing_data';

export interface TokenFlag {
  id: string;
  symbol: string;
  category: TokenFlagCategory;
  notes: string | null;
  flagged_by: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

export const FLAG_CATEGORIES: { value: TokenFlagCategory; label: string; color: string }[] = [
  { value: 'needs_work', label: 'Needs Work', color: 'bg-yellow-500' },
  { value: 'remove', label: 'Remove', color: 'bg-red-500' },
  { value: 'review', label: 'Review', color: 'bg-blue-500' },
  { value: 'suspicious', label: 'Suspicious', color: 'bg-orange-500' },
  { value: 'duplicate', label: 'Duplicate', color: 'bg-purple-500' },
  { value: 'missing_data', label: 'Missing Data', color: 'bg-gray-500' },
];

export function useTokenFlags(symbol?: string) {
  const queryClient = useQueryClient();
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Check admin status
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsAdmin(false);
        setUserId(null);
        return;
      }
      setUserId(user.id);
      
      const { data } = await supabase.rpc('has_role', { 
        _user_id: user.id, 
        _role: 'admin' 
      });
      setIsAdmin(!!data);
    };
    
    checkAdmin();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAdmin();
    });
    
    return () => subscription.unsubscribe();
  }, []);

  // Fetch flags for a specific symbol or all flags
  const { data: flags = [], isLoading, refetch } = useQuery({
    queryKey: ['token-flags', symbol],
    queryFn: async () => {
      let query = supabase
        .from('token_flags')
        .select('*')
        .is('resolved_at', null)
        .order('created_at', { ascending: false });
      
      if (symbol) {
        query = query.eq('symbol', symbol);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as TokenFlag[];
    },
    enabled: isAdmin,
  });

  // Add flag mutation
  const addFlag = useMutation({
    mutationFn: async ({ symbol, category, notes }: { symbol: string; category: TokenFlagCategory; notes?: string }) => {
      if (!userId) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('token_flags')
        .insert({
          symbol,
          category,
          notes: notes || null,
          flagged_by: userId,
        })
        .select()
        .single();
      
      if (error) {
        if (error.code === '23505') {
          throw new Error('This token already has this flag');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['token-flags'] });
      toast.success('Flag added');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Remove flag mutation
  const removeFlag = useMutation({
    mutationFn: async (flagId: string) => {
      const { error } = await supabase
        .from('token_flags')
        .delete()
        .eq('id', flagId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['token-flags'] });
      toast.success('Flag removed');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Resolve flag mutation
  const resolveFlag = useMutation({
    mutationFn: async (flagId: string) => {
      if (!userId) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('token_flags')
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by: userId,
        })
        .eq('id', flagId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['token-flags'] });
      toast.success('Flag resolved');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Check if symbol has a specific flag
  const hasFlag = (sym: string, category?: TokenFlagCategory): boolean => {
    if (category) {
      return flags.some(f => f.symbol === sym && f.category === category);
    }
    return flags.some(f => f.symbol === sym);
  };

  // Get flags for a symbol
  const getFlagsForSymbol = (sym: string): TokenFlag[] => {
    return flags.filter(f => f.symbol === sym);
  };

  return {
    flags,
    isLoading,
    isAdmin,
    addFlag: addFlag.mutate,
    removeFlag: removeFlag.mutate,
    resolveFlag: resolveFlag.mutate,
    hasFlag,
    getFlagsForSymbol,
    refetch,
    isAddingFlag: addFlag.isPending,
  };
}

// Hook for all flags (admin dashboard)
export function useAllTokenFlags() {
  const queryClient = useQueryClient();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsAdmin(false);
        return;
      }
      
      const { data } = await supabase.rpc('has_role', { 
        _user_id: user.id, 
        _role: 'admin' 
      });
      setIsAdmin(!!data);
    };
    
    checkAdmin();
  }, []);

  const { data: flags = [], isLoading } = useQuery({
    queryKey: ['token-flags', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('token_flags')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as TokenFlag[];
    },
    enabled: isAdmin,
  });

  // Group by category
  const flagsByCategory = flags.reduce((acc, flag) => {
    if (!acc[flag.category]) acc[flag.category] = [];
    acc[flag.category].push(flag);
    return acc;
  }, {} as Record<TokenFlagCategory, TokenFlag[]>);

  // Unresolved flags
  const unresolvedFlags = flags.filter(f => !f.resolved_at);

  return {
    flags,
    flagsByCategory,
    unresolvedFlags,
    isLoading,
    isAdmin,
  };
}
