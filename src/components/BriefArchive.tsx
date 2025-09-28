import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, Eye, Search, Archive, ExternalLink } from 'lucide-react';

interface MarketBrief {
  id: string;
  brief_type: string;
  title: string;
  slug: string;
  executive_summary: string;
  sentiment_score: number | null;
  view_count: number;
  published_at: string;
}

interface BriefArchiveProps {
  briefs: MarketBrief[];
  className?: string;
}

export function BriefArchive({ briefs, className = "" }: BriefArchiveProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  const filteredBriefs = briefs.filter(brief => {
    const matchesSearch = brief.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         brief.executive_summary.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDate = !selectedDate || brief.published_at.startsWith(selectedDate);
    return matchesSearch && matchesDate;
  });

  // Group briefs by date
  const groupedBriefs = filteredBriefs.reduce((groups, brief) => {
    const date = new Date(brief.published_at).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(brief);
    return groups;
  }, {} as Record<string, MarketBrief[]>);

  return (
    <Card className={`xr-card-elevated ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-2xl font-pixel">
          <Archive className="h-6 w-6 text-primary" />
          XRay Brief Archive
        </CardTitle>
        <div className="text-base text-muted-foreground">
          Navigate past briefings from the command center • Searchable • JSON API available
        </div>
        
        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search briefs by title or content..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="sm:w-40"
          />
        </div>
      </CardHeader>
      
      <CardContent>
        {Object.keys(groupedBriefs).length > 0 ? (
          <div className="space-y-8">
            {Object.entries(groupedBriefs).map(([date, dayBriefs]) => (
              <div key={date} className="space-y-4">
                {/* Date Header */}
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <Calendar className="h-4 w-4 text-primary" />
                  <h3 className="font-bold text-lg font-pixel text-primary">
                    {new Date(date).toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </h3>
                  <Badge variant="outline" className="text-xs">
                    {dayBriefs.length} brief{dayBriefs.length !== 1 ? 's' : ''}
                  </Badge>
                </div>

                {/* Briefs for this date */}
                <div className="grid gap-4 md:grid-cols-2">
                  {dayBriefs.map((brief) => (
                    <Card key={brief.id} className="xr-card hover:xr-glow-primary transition-all duration-300 cursor-pointer group">
                      <CardContent className="p-5">
                        <div className="space-y-3">
                          {/* Brief Type and Time */}
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-xs font-pixel uppercase">
                              {brief.brief_type.replace('_', '-')}
                            </Badge>
                            <div className="text-xs text-muted-foreground">
                              {new Date(brief.published_at).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </div>
                          
                          {/* Title */}
                          <h4 className="font-bold text-lg group-hover:text-primary transition-colors line-clamp-2">
                            {brief.title}
                          </h4>
                          
                          {/* Executive Summary */}
                          <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                            {brief.executive_summary}
                          </p>
                          
                          {/* Footer */}
                          <div className="flex items-center justify-between pt-2">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-1">
                                <Eye className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">{brief.view_count}</span>
                              </div>
                              {brief.sentiment_score && (
                                <Badge variant={brief.sentiment_score > 0 ? 'default' : 'destructive'} className="text-xs">
                                  {brief.sentiment_score > 0 ? '+' : ''}{brief.sentiment_score.toFixed(1)}
                                </Badge>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                                <ExternalLink className="h-3 w-3 mr-1" />
                                View
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Archive className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No briefs found</h3>
            <p className="text-sm">
              {searchTerm || selectedDate 
                ? "Try adjusting your search terms or date filter"
                : "Archive will populate as briefs are published"
              }
            </p>
          </div>
        )}
        
        {/* API Information */}
        <div className="mt-8 pt-6 border-t border-border">
          <div className="text-center space-y-2">
            <div className="text-sm text-muted-foreground font-pixel">
              📊 Full Brief JSON API available • HTML + structured data
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="font-pixel">30-day retention</Badge>
              <span>•</span>
              <Badge variant="outline" className="font-pixel">Searchable archive</Badge>
              <span>•</span>
              <Badge variant="outline" className="font-pixel">Export ready</Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}