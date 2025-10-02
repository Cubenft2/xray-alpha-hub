import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function GenerateBrief() {
  const [generating, setGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [emergencyPublishing, setEmergencyPublishing] = useState(false);
  const navigate = useNavigate();

  const handleGenerateBrief = async (session?: string) => {
    setGenerating(true);
    try {
      console.log('🚀 Generating market brief with Symbol Intelligence Layer...');
      
      const { data, error } = await supabase.functions.invoke('generate-daily-brief', {
        body: { session: session || 'premarket' }
      });
      
      if (error) {
        console.error('Brief generation error:', error);
        toast.error('Failed to generate brief');
        return;
      }
      
      console.log('✅ Brief generated:', data);
      toast.success('Market brief generated successfully!');
      
      // Navigate to the home page to see the new brief
      setTimeout(() => {
        navigate('/');
      }, 1500);
      
    } catch (error) {
      console.error('Brief generation error:', error);
      toast.error('Failed to generate brief');
    } finally {
      setGenerating(false);
    }
  };

  const handleRefreshData = async () => {
    setRefreshing(true);
    try {
      // Fetch latest brief
      const { data: briefs, error: fetchError } = await supabase
        .from('market_briefs')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (fetchError || !briefs || briefs.length === 0) {
        toast.error('No brief found to refresh');
        return;
      }

      const briefId = briefs[0].id;
      
      console.log('🔄 Refreshing market data for brief:', briefId);
      
      const { data, error } = await supabase.functions.invoke('refresh-brief-data', {
        body: { briefId }
      });
      
      if (error) {
        console.error('Data refresh error:', error);
        toast.error('Failed to refresh data');
        return;
      }
      
      console.log('✅ Data refreshed:', data);
      toast.success('Market data refreshed successfully!');
      
      // Navigate to the home page to see updated brief
      setTimeout(() => {
        navigate('/');
      }, 1500);
      
    } catch (error) {
      console.error('Data refresh error:', error);
      toast.error('Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  };

  const handleEmergencyPublish = async (session: 'premarket' | 'postmarket') => {
    setEmergencyPublishing(true);
    try {
      console.log(`🚨 EMERGENCY PUBLISH: ${session}`);
      
      const { data, error } = await supabase.functions.invoke('generate-daily-brief', {
        body: { session }
      });
      
      if (error) {
        console.error('Emergency publish error:', error);
        toast.error('Emergency publish failed');
        return;
      }
      
      console.log('✅ Emergency brief published:', data);
      toast.success(`${session} brief published! Cache warmed, feed updated.`);
      
      setTimeout(() => {
        navigate('/');
      }, 1500);
      
    } catch (error) {
      console.error('Emergency publish error:', error);
      toast.error('Emergency publish failed');
    } finally {
      setEmergencyPublishing(false);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <Card>
        <CardHeader>
          <CardTitle>Generate Market Brief</CardTitle>
          <CardDescription>
            Create a new market brief with Symbol Intelligence Layer validation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will generate a comprehensive market brief using the Symbol Intelligence Layer for:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li><strong>Symbol Resolution:</strong> Automatic matching via ticker_mappings → cg_master</li>
              <li><strong>Capability Tagging:</strong> Each symbol tagged with price_ok, tv_ok, derivs_ok, social_ok</li>
              <li><strong>Smart Rendering:</strong> Parentheses only if price_ok, TV charts only if tv_ok</li>
              <li><strong>Cache Warming:</strong> Pre-warms quote cache (120-180s TTL)</li>
              <li><strong>Admin Audit:</strong> Detailed capability report for all symbols</li>
              <li><strong>Auto-Insert:</strong> High-confidence matches (≥0.9) added automatically</li>
              <li><strong>Pending Queue:</strong> Low-confidence matches added to pending_ticker_mappings</li>
            </ul>
            
            <div className="grid gap-3">
              <Button 
                onClick={() => handleGenerateBrief()} 
                disabled={generating || refreshing || emergencyPublishing}
                className="w-full"
                size="lg"
              >
                {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {generating ? 'Generating Brief...' : 'Generate New Market Brief'}
              </Button>
              
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  onClick={() => handleEmergencyPublish('premarket')}
                  disabled={generating || refreshing || emergencyPublishing}
                  variant="destructive"
                  size="lg"
                >
                  {emergencyPublishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  🚨 Emergency: Premarket
                </Button>
                <Button 
                  onClick={() => handleEmergencyPublish('postmarket')}
                  disabled={generating || refreshing || emergencyPublishing}
                  variant="destructive"
                  size="lg"
                >
                  {emergencyPublishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  🚨 Emergency: Postmarket
                </Button>
              </div>
              
              <Button 
                onClick={handleRefreshData} 
                disabled={generating || refreshing || emergencyPublishing}
                variant="outline"
                className="w-full"
                size="lg"
              >
                {refreshing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {!refreshing && <RefreshCw className="mr-2 h-4 w-4" />}
                {refreshing ? 'Refreshing Data...' : 'Refresh Latest Brief Data (No AI Cost)'}
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground mt-4">
              <strong>Note:</strong> "Generate New" creates a full brief with AI. <span className="text-destructive font-bold">🚨 Emergency buttons</span> publish immediately with session parameter, update feed index, and warm cache. "Refresh Data" updates market/social panels without AI (free).
            </p>
            <p className="text-xs text-muted-foreground">
              <strong>Emergency mode:</strong> Publishes even if some providers fail. Missing data shows as "unavailable" but brief still goes live.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
