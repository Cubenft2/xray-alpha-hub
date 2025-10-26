import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, RefreshCw, Search, TrendingUp, BookOpen, Clock } from 'lucide-react';

interface QuoteStats {
  total: number;
  byCategory: Record<string, number>;
  mostUsed: Array<{ quote_text: string; author: string; times_used: number }>;
  lastPopulated: string | null;
}

interface PopulationResult {
  success: boolean;
  stats: {
    totalFetched: number;
    totalInserted: number;
    totalDuplicates: number;
    categoriesProcessed: Record<string, number>;
    errors: string[];
  };
}

export default function QuoteLibraryAdmin() {
  const [stats, setStats] = useState<QuoteStats | null>(null);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [populating, setPopulating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [populationResult, setPopulationResult] = useState<PopulationResult | null>(null);

  useEffect(() => {
    loadStats();
    loadQuotes();
  }, []);

  const loadStats = async () => {
    try {
      const { data: allQuotes, error } = await supabase
        .from('quote_library')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      const byCategory = (allQuotes || []).reduce((acc, quote) => {
        const cat = quote.category || 'uncategorized';
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const mostUsed = [...(allQuotes || [])]
        .sort((a, b) => b.times_used - a.times_used)
        .slice(0, 5);

      const lastPop = allQuotes && allQuotes.length > 0
        ? new Date(Math.max(...allQuotes.map(q => new Date(q.created_at).getTime()))).toISOString()
        : null;

      setStats({
        total: allQuotes?.length || 0,
        byCategory,
        mostUsed,
        lastPopulated: lastPop,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
      toast.error('Failed to load quote statistics');
    }
  };

  const loadQuotes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('quote_library')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setQuotes(data || []);
    } catch (error) {
      console.error('Error loading quotes:', error);
      toast.error('Failed to load quotes');
    } finally {
      setLoading(false);
    }
  };

  const handlePopulateQuotes = async () => {
    setPopulating(true);
    setPopulationResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('populate-quotes-library', {
        body: { trigger: 'manual' }
      });

      if (error) throw error;

      // Always show the result
      setPopulationResult(data);

      // Smart toast feedback based on results
      if (data?.success === false) {
        toast.error(data.error || 'Failed to populate quotes');
      } else if (data?.stats) {
        const { totalInserted, totalDuplicates, errors } = data.stats;
        
        if (totalInserted > 0) {
          toast.success(`Added ${totalInserted} new quote${totalInserted !== 1 ? 's' : ''}`);
        } else if (totalDuplicates > 0 && errors.length === 0) {
          toast.message('No new quotes added (all duplicates)');
        } else if (totalInserted === 0 && errors.length === 0) {
          toast.message('No new quotes added');
        }
        
        if (errors.length > 0) {
          toast.warning(`${errors.length} quote${errors.length !== 1 ? 's' : ''} skipped: ${errors[0]}`);
        }
      }
      
      await loadStats();
      await loadQuotes();
    } catch (error: any) {
      console.error('Error populating quotes:', error);
      toast.error(error.message || 'Failed to populate quotes');
    } finally {
      setPopulating(false);
    }
  };

  const filteredQuotes = quotes.filter(quote => {
    const matchesSearch = searchTerm === '' || 
      quote.quote_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.author.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || quote.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  const categories = stats ? Object.keys(stats.byCategory).sort() : [];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Quote Library Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage your quote library with manual population and automated scheduling
        </p>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Quotes</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Active quotes in library
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categories.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Quote categories available
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Last Updated</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.lastPopulated 
                ? new Date(stats.lastPopulated).toLocaleDateString()
                : 'Never'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Most recent quote added
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Manual Population Widget */}
      <Card>
        <CardHeader>
          <CardTitle>Populate Quotes</CardTitle>
          <CardDescription>
            Manually fetch new quotes from API Ninjas. Automated population runs twice daily at 6 AM and 6 PM UTC.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={handlePopulateQuotes} 
            disabled={populating}
            size="lg"
            className="w-full sm:w-auto"
          >
            {populating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Populating Quotes...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Populate Quote Library
              </>
            )}
          </Button>

          {populationResult && populationResult.stats && (
            <div className="mt-4 p-4 border rounded-lg bg-muted/50">
              <h4 className="font-semibold mb-2">Population Results:</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Fetched</p>
                  <p className="text-xl font-bold">{populationResult.stats.totalFetched}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Inserted</p>
                  <p className="text-xl font-bold text-green-600">{populationResult.stats.totalInserted}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Duplicates</p>
                  <p className="text-xl font-bold text-yellow-600">{populationResult.stats.totalDuplicates}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Errors</p>
                  <p className="text-xl font-bold text-red-600">{populationResult.stats.errors.length}</p>
                </div>
              </div>
              
              {populationResult.stats.errors.length > 0 && (
                <div className="mt-4 p-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded">
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Skipped Quotes:</p>
                  <ul className="text-xs text-yellow-700 dark:text-yellow-300 mt-1 list-disc list-inside">
                    {populationResult.stats.errors.slice(0, 3).map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {Object.keys(populationResult.stats.categoriesProcessed).length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">By Category:</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(populationResult.stats.categoriesProcessed).map(([cat, count]) => (
                      <Badge key={cat} variant="secondary">
                        {cat}: {count}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      {stats && Object.keys(stats.byCategory).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Category Breakdown</CardTitle>
            <CardDescription>Quotes distribution across categories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.byCategory).map(([category, count]) => (
                <Badge key={category} variant="outline" className="text-sm">
                  {category}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quote Library Viewer */}
      <Card>
        <CardHeader>
          <CardTitle>Quote Library</CardTitle>
          <CardDescription>Browse and search all quotes in the library</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search quotes or authors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50%]">Quote</TableHead>
                    <TableHead>Author</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Times Used</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuotes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No quotes found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredQuotes.slice(0, 50).map((quote) => (
                      <TableRow key={quote.id}>
                        <TableCell className="font-medium whitespace-pre-wrap break-words text-pretty">
                          {quote.quote_text}
                        </TableCell>
                        <TableCell>{quote.author}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{quote.category || 'uncategorized'}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{quote.times_used || 0}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          
          {filteredQuotes.length > 50 && (
            <p className="text-sm text-muted-foreground text-center">
              Showing first 50 of {filteredQuotes.length} quotes
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
