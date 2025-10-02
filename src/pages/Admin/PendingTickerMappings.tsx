import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

interface PendingMapping {
  id: string;
  symbol: string;
  normalized_symbol: string;
  display_name: string | null;
  coingecko_id: string | null;
  tradingview_symbol: string | null;
  polygon_ticker: string | null;
  aliases: string[] | null;
  confidence_score: number;
  match_type: string | null;
  status: string;
  seen_count: number;
  auto_approved: boolean | null;
  validation_notes: string | null;
  context: any;
  created_at: string;
}

export function PendingTickerMappings() {
  const [pending, setPending] = useState<PendingMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PendingMapping>>({});
  
  // Filters
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [matchTypeFilter, setMatchTypeFilter] = useState<string>('all');
  const [minSeenCount, setMinSeenCount] = useState<number>(0);

  useEffect(() => {
    fetchPending();
  }, [minConfidence, matchTypeFilter, minSeenCount]);

  const fetchPending = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('pending_ticker_mappings')
        .select('*')
        .eq('status', 'pending')
        .gte('confidence_score', minConfidence)
        .gte('seen_count', minSeenCount);

      if (matchTypeFilter !== 'all') {
        query = query.eq('match_type', matchTypeFilter);
      }

      const { data, error } = await query
        .order('seen_count', { ascending: false })
        .order('confidence_score', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPending(data || []);
    } catch (error) {
      console.error('Error fetching pending mappings:', error);
      toast.error('Failed to load pending mappings');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveAll = async () => {
    if (!confirm('Auto-approve all high-confidence exact matches?')) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('auto_approve_pending_mappings');

      if (error) throw error;

      const result = data[0];
      toast.success(`Approved ${result.approved_count} mappings, rejected ${result.rejected_count}`);
      fetchPending();
    } catch (error: any) {
      console.error('Error bulk approving:', error);
      toast.error(error.message || 'Failed to bulk approve');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (mapping: PendingMapping) => {
    try {
      // Insert into ticker_mappings
      const { error: insertError } = await supabase
        .from('ticker_mappings')
        .insert({
          symbol: mapping.normalized_symbol,
          display_name: mapping.display_name || `${mapping.symbol} (${mapping.normalized_symbol})`,
          type: 'crypto',
          coingecko_id: mapping.coingecko_id,
          tradingview_symbol: mapping.tradingview_symbol,
          polygon_ticker: mapping.polygon_ticker,
          aliases: mapping.aliases || [mapping.normalized_symbol],
          price_supported: !!mapping.coingecko_id || !!mapping.polygon_ticker,
          tradingview_supported: !!mapping.tradingview_symbol,
          is_active: true,
        });

      if (insertError) throw insertError;

      // Update pending status
      const { error: updateError } = await supabase
        .from('pending_ticker_mappings')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', mapping.id);

      if (updateError) throw updateError;

      toast.success(`Approved ${mapping.symbol}`);
      fetchPending();
    } catch (error) {
      console.error('Error approving mapping:', error);
      toast.error('Failed to approve mapping');
    }
  };

  const handleReject = async (id: string) => {
    try {
      const { error } = await supabase
        .from('pending_ticker_mappings')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      toast.success('Mapping rejected');
      fetchPending();
    } catch (error) {
      console.error('Error rejecting mapping:', error);
      toast.error('Failed to reject mapping');
    }
  };

  const handleEdit = (mapping: PendingMapping) => {
    setEditingId(mapping.id);
    setEditForm({
      display_name: mapping.display_name || '',
      coingecko_id: mapping.coingecko_id || '',
      tradingview_symbol: mapping.tradingview_symbol || '',
      polygon_ticker: mapping.polygon_ticker || '',
      aliases: mapping.aliases || [],
    });
  };

  const handleSaveEdit = async (id: string) => {
    try {
      const { error } = await supabase
        .from('pending_ticker_mappings')
        .update(editForm)
        .eq('id', id);

      if (error) throw error;
      toast.success('Mapping updated');
      setEditingId(null);
      fetchPending();
    } catch (error) {
      console.error('Error updating mapping:', error);
      toast.error('Failed to update mapping');
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Pending Ticker Mappings</h1>
          <p className="text-sm text-muted-foreground">{pending.length} pending mappings</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleApproveAll} disabled={loading}>
            Approve All Exact Matches
          </Button>
          <Button onClick={fetchPending} variant="outline" disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Min Confidence</Label>
              <Input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={minConfidence}
                onChange={(e) => setMinConfidence(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>Match Type</Label>
              <select
                className="w-full border rounded px-3 py-2"
                value={matchTypeFilter}
                onChange={(e) => setMatchTypeFilter(e.target.value)}
              >
                <option value="all">All</option>
                <option value="exact_symbol">Exact Symbol</option>
                <option value="fuzzy_name">Fuzzy Name</option>
                <option value="no_match">No Match</option>
              </select>
            </div>
            <div>
              <Label>Min Seen Count</Label>
              <Input
                type="number"
                min="0"
                value={minSeenCount}
                onChange={(e) => setMinSeenCount(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={() => { 
                  setMinConfidence(0); 
                  setMatchTypeFilter('all'); 
                  setMinSeenCount(0); 
                }} 
                variant="outline"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending list */}
      <Card>
        <CardHeader>
          <CardTitle>Review Queue</CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-muted-foreground">No pending mappings</p>
          ) : (
            <div className="space-y-4">
              {pending.map((mapping) => (
                <Card key={mapping.id}>
                  <CardContent className="pt-6">
                    {editingId === mapping.id ? (
                      <div className="space-y-4">
                        <div>
                          <Label>Symbol</Label>
                          <Input value={mapping.normalized_symbol} disabled />
                        </div>
                        <div>
                          <Label>Display Name</Label>
                          <Input
                            value={editForm.display_name || ''}
                            onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>CoinGecko ID</Label>
                          <Input
                            value={editForm.coingecko_id || ''}
                            onChange={(e) => setEditForm({ ...editForm, coingecko_id: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>TradingView Symbol</Label>
                          <Input
                            value={editForm.tradingview_symbol || ''}
                            onChange={(e) => setEditForm({ ...editForm, tradingview_symbol: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Polygon Ticker</Label>
                          <Input
                            value={editForm.polygon_ticker || ''}
                            onChange={(e) => setEditForm({ ...editForm, polygon_ticker: e.target.value })}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={() => handleSaveEdit(mapping.id)}>Save</Button>
                          <Button variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-lg">{mapping.symbol}</h3>
                              <Badge variant={mapping.confidence_score >= 0.9 ? 'default' : mapping.confidence_score >= 0.7 ? 'secondary' : 'destructive'}>
                                {(mapping.confidence_score * 100).toFixed(0)}% confidence
                              </Badge>
                              {mapping.match_type && (
                                <Badge variant="outline">{mapping.match_type}</Badge>
                              )}
                              {mapping.seen_count > 1 && (
                                <Badge className="bg-blue-600">Seen {mapping.seen_count}x</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Normalized: <span className="font-mono">{mapping.normalized_symbol}</span>
                            </p>
                          </div>
                        </div>
                        
                        {mapping.display_name && (
                          <p><strong>Display Name:</strong> {mapping.display_name}</p>
                        )}
                        {mapping.coingecko_id && (
                          <p><strong>CoinGecko ID:</strong> {mapping.coingecko_id}</p>
                        )}
                        {mapping.tradingview_symbol && (
                          <p><strong>TradingView:</strong> {mapping.tradingview_symbol}</p>
                        )}
                        {mapping.context && (
                          <p className="text-sm text-muted-foreground">
                            <strong>Context:</strong> {JSON.stringify(mapping.context, null, 2)}
                          </p>
                        )}
                        
                        <div className="flex gap-2 mt-4">
                          <Button onClick={() => handleApprove(mapping)}>
                            Approve & Add
                          </Button>
                          <Button variant="outline" onClick={() => handleEdit(mapping)}>
                            Edit
                          </Button>
                          <Button variant="destructive" onClick={() => handleReject(mapping.id)}>
                            Reject
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
