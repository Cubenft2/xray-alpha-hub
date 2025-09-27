import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { triggerMarketBrief } from '@/utils/marketBriefTrigger';

export function SimpleBriefTrigger() {
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  const generateNewBrief = async () => {
    try {
      setGenerating(true);
      
      toast({
        title: "Generating Fresh Brief",
        description: "Fetching latest news and creating market brief...",
      });

      const result = await triggerMarketBrief({
        force: true,
        notes: `Manual generation at ${new Date().toLocaleString()}`
      });

      if (result.success) {
        toast({
          title: "Brief Generated Successfully!",
          description: "New market brief created with latest news. Refresh the page to see it.",
        });
        
        // Auto refresh the page after 2 seconds
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        throw new Error(result.error || 'Unknown error');
      }

    } catch (error) {
      console.error('Brief generation failed:', error);
      toast({
        title: "Generation Failed",
        description: `Could not generate brief: ${error}`,
        variant: "destructive"
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5" />
          Generate Fresh Brief
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Create a new market brief with the latest real news from crypto, stocks, and macro markets.
        </p>
        <Button 
          onClick={generateNewBrief}
          disabled={generating}
          className="w-full"
        >
          {generating ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 mr-2" />
              Generate Now
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}