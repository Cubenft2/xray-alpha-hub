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
  status: string;
  context: any;
  created_at: string;
}

export function PendingTickerMappings() {
  const [pending, setPending] = useState<PendingMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PendingMapping>>({});

  useEffect(() => {
    fetchPending();
  }, []);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pending_ticker_mappings')
        .select('*')
        .eq('status', 'pending')
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
    <div className="container mx-auto p-8">
      <Card>
        <CardHeader>
          <CardTitle>Pending Ticker Mappings</CardTitle>
          <CardDescription>
            Review and approve ticker mappings that need manual verification
          </CardDescription>
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
                            <h3 className="font-semibold text-lg">{mapping.symbol}</h3>
                            <p className="text-sm text-muted-foreground">
                              Normalized: {mapping.normalized_symbol}
                            </p>
                          </div>
                          <Badge variant={mapping.confidence_score >= 0.9 ? 'default' : 'secondary'}>
                            {(mapping.confidence_score * 100).toFixed(0)}% confidence
                          </Badge>
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
