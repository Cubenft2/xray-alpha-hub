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
    crypto_snapshot?: TestResult;
    account_status?: TestResult;
    eth_snapshot?: TestResult;
  };
}

export function PolygonDiagnostics() {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<DiagnosticResults | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setResults(null);

    try {
      console.log('🔍 Starting Polygon API diagnostics...');
      
      const { data, error } = await supabase.functions.invoke('test-polygon-api');

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
        toast.success('Polygon API is working! ✅', {
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
            {testName === 'Crypto Snapshot (BTC)' && result.price && (
              <div className="space-y-1">
                <p>✅ Price: ${result.price?.toLocaleString()}</p>
                <p>✅ Age: {result.ageMinutes?.toFixed(1)} minutes</p>
                <p>✅ Data Fresh: {result.dataFresh ? 'Yes' : 'No'}</p>
                <p>✅ Price Valid: {result.priceValid ? 'Yes' : 'No'}</p>
              </div>
            )}
            {testName === 'ETH Snapshot' && result.price && (
              <p>✅ ETH Price: ${result.price?.toLocaleString()}</p>
            )}
            {testName === 'Account Status' && (
              <p>✅ API key is valid</p>
            )}
          </div>
        ) : (
          <div className="text-sm text-red-600 dark:text-red-400">
            <p>❌ Error: {result.error || 'Unknown error'}</p>
            {result.status && <p>HTTP Status: {result.status}</p>}
          </div>
        )}

        {/* Show raw data for debugging */}
        {result.rawTicker && (
          <details className="text-xs text-muted-foreground mt-2">
            <summary className="cursor-pointer hover:text-foreground">
              Show raw data
            </summary>
            <pre className="mt-2 p-2 bg-muted rounded overflow-x-auto">
              {JSON.stringify(result.rawTicker, null, 2)}
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
            🔍 Polygon API Diagnostics
          </CardTitle>
          <CardDescription>
            Test your Polygon.io API key and verify data connectivity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This diagnostic tool will test your Polygon API key by:
          </p>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>✅ Fetching BTC price from crypto snapshot endpoint</li>
            <li>✅ Checking account status and authentication</li>
            <li>✅ Fetching ETH price for comparison</li>
            <li>✅ Validating data freshness and price sanity</li>
          </ul>

          <Button 
            onClick={handleTest} 
            disabled={testing}
            className="w-full"
            size="lg"
          >
            {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {testing ? 'Running Diagnostics...' : 'Run Polygon API Test'}
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
                {renderTestResult('Crypto Snapshot (BTC)', results.tests.crypto_snapshot)}
                {renderTestResult('Account Status', results.tests.account_status)}
                {renderTestResult('ETH Snapshot', results.tests.eth_snapshot)}
              </div>

              {results.success && (
                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-500">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-blue-600" />
                    Next Steps
                  </h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>✅ Your Polygon API key is working correctly</li>
                    <li>✅ Data is fresh and accurate</li>
                    <li>➡️ Go to <strong>Polygon Sync</strong> to start the price relay</li>
                    <li>➡️ Generate a new market brief to see Polygon data in action</li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
