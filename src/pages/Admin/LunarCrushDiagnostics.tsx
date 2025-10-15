import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

interface TestResult {
  passed: boolean;
  error?: string;
  [key: string]: any;
}

interface DiagnosticResults {
  success: boolean;
  timestamp: string;
  apiKeyPresent: boolean;
  summary?: string;
  tests: {
    social_data?: TestResult;
    universe_data?: TestResult;
    coin_detail?: TestResult;
  };
}

export function LunarCrushDiagnostics() {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<DiagnosticResults | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setResults(null);

    try {
      console.log('🌙 Starting LunarCrush API diagnostics...');
      
      const { data, error } = await supabase.functions.invoke('test-lunarcrush-api');

      if (error) {
        console.error('Edge function error:', error);
        toast.error('Failed to run diagnostics', {
          description: error.message
        });
        return;
      }

      console.log('Diagnostic results:', data);
      setResults(data);

      if (data.success) {
        toast.success('LunarCrush API is working! ✅', {
          description: data.summary || 'All tests passed'
        });
      } else {
        toast.error('Some tests failed ❌', {
          description: data.summary || 'Check the results below'
        });
      }
    } catch (error: any) {
      console.error('Error running diagnostics:', error);
      toast.error('Failed to run diagnostics', {
        description: error.message
      });
    } finally {
      setTesting(false);
    }
  };

  const renderTestResult = (testName: string, result?: TestResult) => {
    if (!result) return null;

    const icon = result.passed ? (
      <CheckCircle2 className="h-5 w-5 text-green-500" />
    ) : (
      <XCircle className="h-5 w-5 text-red-500" />
    );

    return (
      <div className="border rounded-lg p-4 space-y-2">
        <div className="flex items-center gap-2">
          {icon}
          <h4 className="font-semibold">{testName}</h4>
        </div>
        
        {result.passed ? (
          <div className="text-sm text-muted-foreground">
            {testName === 'Social Data API' && (
              <div className="space-y-1">
                <p>✅ Assets fetched: {result.assetCount}</p>
                <p>✅ BTC found: {result.btcFound ? 'Yes' : 'No'} {result.btcGalaxyScore && `(Galaxy Score: ${result.btcGalaxyScore})`}</p>
                <p>✅ ETH found: {result.ethFound ? 'Yes' : 'No'} {result.ethGalaxyScore && `(Galaxy Score: ${result.ethGalaxyScore})`}</p>
              </div>
            )}
            {testName === 'Universe Data API' && (
              <div className="space-y-1">
                <p>✅ Total coins: {result.totalCoins?.toLocaleString()}</p>
                <p>✅ Total market cap: ${(result.totalMarketCap / 1e12)?.toFixed(2)}T</p>
                <p>✅ Average galaxy score: {result.averageGalaxyScore?.toFixed(1)}</p>
                {result.sampleCoin && (
                  <p>✅ Sample: {result.sampleCoin.name} (${result.sampleCoin.price?.toFixed(2)})</p>
                )}
              </div>
            )}
            {testName === 'Coin Detail API' && (
              <div className="space-y-1">
                <p>✅ Coin: {result.coinName} ({result.symbol})</p>
                <p>✅ Price: ${result.price?.toLocaleString()}</p>
                <p>✅ Market Cap: ${(result.marketCap / 1e9)?.toFixed(2)}B</p>
                <p>✅ Galaxy Score: {result.galaxyScore?.toFixed(1)}</p>
                {result.riskLevel && <p>✅ Risk Level: {result.riskLevel}</p>}
                {result.trends && <p>✅ Trends: {result.trends}</p>}
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-red-600 dark:text-red-400">
            <p>❌ Error: {result.error || 'Unknown error'}</p>
          </div>
        )}

        {/* Show sample data for debugging */}
        {result.sampleAsset && (
          <details className="text-xs text-muted-foreground mt-2">
            <summary className="cursor-pointer hover:text-foreground">
              Show sample asset data
            </summary>
            <pre className="mt-2 p-2 bg-muted rounded overflow-x-auto">
              {JSON.stringify(result.sampleAsset, null, 2)}
            </pre>
          </details>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🌙 LunarCrush API Diagnostics
          </CardTitle>
          <CardDescription>
            Test your LunarCrush API key and verify social data connectivity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This diagnostic tool will test your LunarCrush API by:
          </p>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>✅ Fetching social sentiment data for top crypto assets</li>
            <li>✅ Testing the universe endpoint for market overview</li>
            <li>✅ Fetching detailed coin data for Bitcoin</li>
            <li>✅ Validating galaxy scores, social volume, and trends</li>
          </ul>

          <Button 
            onClick={handleTest} 
            disabled={testing}
            className="w-full"
            size="lg"
          >
            {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {testing ? 'Running Diagnostics...' : 'Run LunarCrush API Test'}
          </Button>

          {results && (
            <div className="space-y-4 mt-6">
              <div className={`p-4 rounded-lg border-2 ${
                results.success 
                  ? 'bg-green-50 dark:bg-green-950 border-green-500' 
                  : 'bg-red-50 dark:bg-red-950 border-red-500'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {results.success ? (
                    <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                  ) : (
                    <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                  )}
                  <h3 className="font-bold text-lg">
                    {results.success ? 'All Tests Passed ✅' : 'Some Tests Failed ❌'}
                  </h3>
                </div>
                <p className="text-sm">{results.summary}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Tested at: {new Date(results.timestamp).toLocaleString()}
                </p>
              </div>

              <div className="space-y-3">
                {renderTestResult('Social Data API', results.tests.social_data)}
                {renderTestResult('Universe Data API', results.tests.universe_data)}
                {renderTestResult('Coin Detail API', results.tests.coin_detail)}
              </div>

              {results.success && (
                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-500">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-blue-600" />
                    Next Steps
                  </h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>✅ Your LunarCrush API key is working correctly</li>
                    <li>✅ Social sentiment data is available</li>
                    <li>✅ Universe and coin detail endpoints are functional</li>
                    <li>➡️ Generate a new market brief to see LunarCrush data in action</li>
                  </ul>
                </div>
              )}

              {!results.apiKeyPresent && (
                <div className="bg-yellow-50 dark:bg-yellow-950 p-4 rounded-lg border border-yellow-500">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    API Key Not Configured
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    The LUNARCRUSH_API_KEY environment variable is not set. Please configure it in your Supabase project settings.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
