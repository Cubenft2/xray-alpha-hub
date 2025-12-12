import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText, Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function DataExport() {
  const [loading, setLoading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const fetchAllRecords = async () => {
    const allData: { cg_id: string; symbol: string; name: string }[] = [];
    const pageSize = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('cg_master')
        .select('cg_id, symbol, name')
        .order('cg_id', { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        allData.push(...data);
        offset += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    return allData;
  };

  const exportCoinGeckoIds = async () => {
    setLoading(true);
    setDownloaded(false);
    
    try {
      const data = await fetchAllRecords();

      if (data.length === 0) {
        toast.error('No CoinGecko IDs found');
        return;
      }

      // Generate plain text file with one ID per line
      const content = data.map(row => row.cg_id).join('\n');
      
      // Create and download file
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `coingecko-ids-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Downloaded ${data.length.toLocaleString()} CoinGecko IDs`);
      setDownloaded(true);
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export CoinGecko IDs');
    } finally {
      setLoading(false);
    }
  };

  const exportCoinGeckoCsv = async () => {
    setLoading(true);
    setDownloaded(false);
    
    try {
      const data = await fetchAllRecords();

      if (data.length === 0) {
        toast.error('No CoinGecko IDs found');
        return;
      }

      // Generate CSV with headers
      const headers = 'cg_id,symbol,name';
      const rows = data.map(row => 
        `"${row.cg_id}","${row.symbol}","${(row.name || '').replace(/"/g, '""')}"`
      );
      const content = [headers, ...rows].join('\n');
      
      const blob = new Blob([content], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `coingecko-full-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Downloaded ${data.length.toLocaleString()} tokens as CSV`);
      setDownloaded(true);
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export CSV');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Data Export</h2>
        <p className="text-muted-foreground">Export database data for external use</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            CoinGecko IDs Export
          </CardTitle>
          <CardDescription>
            Download all 20,000+ CoinGecko IDs from the cg_master table
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button 
              onClick={exportCoinGeckoIds} 
              disabled={loading}
              variant="default"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : downloaded ? (
                <Check className="mr-2 h-4 w-4" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Download IDs Only (.txt)
            </Button>
            
            <Button 
              onClick={exportCoinGeckoCsv} 
              disabled={loading}
              variant="outline"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Download Full CSV (ID + Symbol + Name)
            </Button>
          </div>
          
          <p className="text-sm text-muted-foreground">
            TXT file contains one CoinGecko ID per line for easy copy/paste. 
            CSV includes symbol and name columns for reference.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
