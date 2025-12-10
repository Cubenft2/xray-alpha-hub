import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, CheckCircle, XCircle, AlertCircle, Zap, TrendingUp } from 'lucide-react';

interface TestResult {
  passed: boolean;
  error?: string;
}

interface PolygonDiagnosticResults {
  success: boolean;
  timestamp: string;
  tests: {
    cryptoSnapshot?: TestResult & { price?: number; symbol?: string };
    accountStatus?: TestResult & { plan?: string };
    ethPrice?: TestResult & { price?: number };
  };
}

interface LunarCrushDiagnosticResults {
  success: boolean;
  timestamp: string;
  apiKeyPresent: boolean;
  summary: string;
  tests: {
    coinsList?: TestResult & { count?: number };
    categoryData?: TestResult & { count?: number };
    socialData?: TestResult;
  };
}

export function Diagnostics() {
  const [testingPolygon, setTestingPolygon] = useState(false);
  const [testingLunarCrush, setTestingLunarCrush] = useState(false);
  const [polygonResults, setPolygonResults] = useState<PolygonDiagnosticResults | null>(null);
  const [lunarCrushResults, setLunarCrushResults] = useState<LunarCrushDiagnosticResults | null>(null);

  const handlePolygonTest = async () => {
    setTestingPolygon(true);
    setPolygonResults(null);
    try {
      const { data, error } = await supabase.functions.invoke('test-polygon-api');
      if (error) throw error;
      setPolygonResults(data);
      toast.success(data.success ? 'Polygon API tests passed' : 'Some Polygon tests failed');
    } catch (error: any) {
      toast.error('Failed to run Polygon diagnostics', { description: error.message });
    } finally {
      setTestingPolygon(false);
    }
  };

  const handleLunarCrushTest = async () => {
    setTestingLunarCrush(true);
    setLunarCrushResults(null);
    try {
      const { data, error } = await supabase.functions.invoke('test-lunarcrush-api');
      if (error) throw error;
      setLunarCrushResults(data);
      toast.success(data.success ? 'LunarCrush API tests passed' : 'Some LunarCrush tests failed');
    } catch (error: any) {
      toast.error('Failed to run LunarCrush diagnostics', { description: error.message });
    } finally {
      setTestingLunarCrush(false);
    }
  };

  const renderTestResult = (name: string, result?: TestResult & Record<string, any>) => {
    if (!result) return null;
    
    return (
      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
        {result.passed ? (
          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
        ) : (
          <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{name}</span>
            <Badge variant={result.passed ? 'default' : 'destructive'}>
              {result.passed ? 'PASS' : 'FAIL'}
            </Badge>
          </div>
          {result.passed ? (
            <div className="text-sm text-muted-foreground mt-1">
              {result.price && <span>Price: ${result.price.toLocaleString()}</span>}
              {result.symbol && <span className="ml-2">Symbol: {result.symbol}</span>}
              {result.plan && <span>Plan: {result.plan}</span>}
              {result.count !== undefined && <span>Count: {result.count}</span>}
            </div>
          ) : (
            <p className="text-sm text-red-600 mt-1">{result.error}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">API Diagnostics</h1>
        <p className="text-muted-foreground">
          Test API connections and verify data source health
        </p>
      </div>

      {/* Polygon Diagnostics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Polygon.io API Diagnostics
          </CardTitle>
          <CardDescription>
            Test crypto snapshots, account status, and price endpoints
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={handlePolygonTest} 
            disabled={testingPolygon}
            className="w-full"
          >
            {testingPolygon && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {testingPolygon ? 'Running Tests...' : 'Run Polygon Diagnostics'}
          </Button>

          {polygonResults && (
            <div className="space-y-3 mt-4">
              <div className="flex items-center gap-2">
                {polygonResults.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                )}
                <span className="font-medium">
                  {polygonResults.success ? 'All Tests Passed' : 'Some Tests Failed'}
                </span>
                <span className="text-sm text-muted-foreground ml-auto">
                  {new Date(polygonResults.timestamp).toLocaleTimeString()}
                </span>
              </div>

              {renderTestResult('Crypto Snapshot', polygonResults.tests.cryptoSnapshot)}
              {renderTestResult('Account Status', polygonResults.tests.accountStatus)}
              {renderTestResult('ETH Price Check', polygonResults.tests.ethPrice)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* LunarCrush Diagnostics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            LunarCrush API Diagnostics
          </CardTitle>
          <CardDescription>
            Test social data endpoints and API key configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={handleLunarCrushTest} 
            disabled={testingLunarCrush}
            className="w-full"
          >
            {testingLunarCrush && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {testingLunarCrush ? 'Running Tests...' : 'Run LunarCrush Diagnostics'}
          </Button>

          {lunarCrushResults && (
            <div className="space-y-3 mt-4">
              <div className="flex items-center gap-2">
                {lunarCrushResults.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                )}
                <span className="font-medium">
                  {lunarCrushResults.success ? 'All Tests Passed' : 'Some Tests Failed'}
                </span>
                <Badge variant={lunarCrushResults.apiKeyPresent ? 'default' : 'destructive'}>
                  API Key: {lunarCrushResults.apiKeyPresent ? 'Present' : 'Missing'}
                </Badge>
              </div>

              {lunarCrushResults.summary && (
                <p className="text-sm text-muted-foreground">{lunarCrushResults.summary}</p>
              )}

              {renderTestResult('Coins List', lunarCrushResults.tests.coinsList)}
              {renderTestResult('Category Data', lunarCrushResults.tests.categoryData)}
              {renderTestResult('Social Data', lunarCrushResults.tests.socialData)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Troubleshooting Tips</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p><strong>Polygon API fails:</strong> Check POLYGON_API_KEY in Supabase secrets</p>
          <p><strong>LunarCrush API fails:</strong> Check LUNARCRUSH_API_KEY in Supabase secrets</p>
          <p><strong>Rate limiting:</strong> Wait a few minutes and try again</p>
          <p><strong>All tests fail:</strong> Check edge function logs in Supabase dashboard</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default Diagnostics;
