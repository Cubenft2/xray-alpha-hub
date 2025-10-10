import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Database, CheckCircle, XCircle, AlertCircle, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export function CoinGeckoEnrich() {
  const [isLoading, setIsLoading] = useState(false);
  const [batchSize, setBatchSize] = useState(50);
  const [forceUpdate, setForceUpdate] = useState(false);
  const [priorityMappings, setPriorityMappings] = useState(true);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  // Fetch enrichment statistics
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['coingecko-enrichment-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cg_master')
        .select('enrichment_status', { count: 'exact' });

      if (error) throw error;

      const statusCounts = {
        total: data?.length || 0,
        pending: 0,
        enriched: 0,
        no_platforms: 0,
        error: 0
      };

      data?.forEach((row: any) => {
        const status = row.enrichment_status || 'pending';
        if (status in statusCounts) {
          statusCounts[status as keyof typeof statusCounts]++;
        }
      });

      return statusCounts;
    },
    refetchInterval: 30000 // Refresh every 30s
  });

  const handleEnrich = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('coingecko-enrich', {
        body: {
          batch_size: batchSize,
          force_update: forceUpdate,
          priority_mappings: priorityMappings
        }
      });

      if (error) throw error;

      setResult(data);
      refetchStats();

      toast({
        title: "Enrichment Complete",
        description: `✅ Enriched ${data.enriched} coins, ${data.skipped} skipped, ${data.failed} failed. ${data.remaining} remaining.`,
      });
    } catch (error: any) {
      console.error('Error enriching:', error);
      toast({
        title: "Enrichment Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            CoinGecko Platform Data Enrichment
          </CardTitle>
          <CardDescription>
            Batch process coins to fetch comprehensive platform/contract address data from CoinGecko API.
            Processes coins with missing or incomplete platform data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Statistics */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Total Coins</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-green-600">{stats.enriched.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Enriched</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-yellow-600">{stats.pending.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-blue-600">{stats.no_platforms.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">No Platforms</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-red-600">{stats.error.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Errors</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Configuration */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="batch-size">Batch Size (1-100)</Label>
              <Input
                id="batch-size"
                type="number"
                min="1"
                max="100"
                value={batchSize}
                onChange={(e) => setBatchSize(Math.min(100, Math.max(1, parseInt(e.target.value) || 50)))}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Number of coins to process per batch. Higher = faster but more API calls.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="priority-mappings">Priority Ticker Mappings</Label>
                <p className="text-xs text-muted-foreground">
                  Process coins with existing ticker_mappings first
                </p>
              </div>
              <Switch
                id="priority-mappings"
                checked={priorityMappings}
                onCheckedChange={setPriorityMappings}
                disabled={isLoading}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="force-update">Force Re-enrichment</Label>
                <p className="text-xs text-muted-foreground">
                  Re-process coins that are already enriched
                </p>
              </div>
              <Switch
                id="force-update"
                checked={forceUpdate}
                onCheckedChange={setForceUpdate}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Action Button */}
          <Button 
            onClick={handleEnrich}
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enriching... (this may take a few minutes)
              </>
            ) : (
              <>
                <TrendingUp className="mr-2 h-4 w-4" />
                Start Enrichment Batch
              </>
            )}
          </Button>

          {/* Results */}
          {result && (
            <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-semibold">Batch Complete!</span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="font-bold text-lg">{result.enriched}</div>
                      <div className="text-muted-foreground">Enriched</div>
                    </div>
                    <div>
                      <div className="font-bold text-lg">{result.skipped}</div>
                      <div className="text-muted-foreground">Skipped</div>
                    </div>
                    <div>
                      <div className="font-bold text-lg">{result.failed}</div>
                      <div className="text-muted-foreground">Failed</div>
                    </div>
                    <div>
                      <div className="font-bold text-lg">{result.remaining}</div>
                      <div className="text-muted-foreground">Remaining</div>
                    </div>
                  </div>

                  {result.details && result.details.length > 0 && (
                    <details className="mt-4">
                      <summary className="cursor-pointer font-semibold">View Details</summary>
                      <div className="mt-2 max-h-64 overflow-y-auto space-y-1">
                        {result.details.map((detail: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2 text-xs py-1 border-b border-green-200 dark:border-green-800">
                            {detail.status === 'enriched' && <CheckCircle className="h-3 w-3 text-green-600" />}
                            {detail.status === 'no_platforms' && <AlertCircle className="h-3 w-3 text-blue-600" />}
                            {detail.status === 'error' && <XCircle className="h-3 w-3 text-red-600" />}
                            <span className="font-mono">{detail.symbol}</span>
                            <span className="text-muted-foreground">{detail.cg_id}</span>
                            {detail.platform_count > 0 && (
                              <span className="ml-auto text-muted-foreground">{detail.platform_count} platforms</span>
                            )}
                            {detail.error && (
                              <span className="ml-auto text-red-600">{detail.error}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Information Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">How It Works</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>1. Queries <code>cg_master</code> for coins needing enrichment</p>
            <p>2. Calls CoinGecko <code>/coins/{'{id}'}</code> API for each coin</p>
            <p>3. Extracts full platform/contract address data</p>
            <p>4. Updates database with enriched data</p>
            <p>5. Respects rate limits (150ms delay between calls)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Best Practices</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>• Start with small batches (50 coins) to test</p>
            <p>• Use Priority Mappings for immediate ticker needs</p>
            <p>• Monitor rate limits and API usage</p>
            <p>• Run during off-peak hours for large batches</p>
            <p>• Check error details if failures occur</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
