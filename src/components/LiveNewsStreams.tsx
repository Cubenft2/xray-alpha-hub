import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, Volume2, ExternalLink, TrendingUp } from 'lucide-react';

interface NewsChannel {
  id: string;
  name: string;
  description: string;
  youtubeId: string;
  category: string;
  live: boolean;
}

const newsChannels: NewsChannel[] = [
  {
    id: '1',
    name: 'Yahoo Finance',
    description: 'Live market coverage and financial news',
    youtubeId: 'KQp-e_XQnDE',
    category: 'Markets',
    live: true
  },
  {
    id: '2',
    name: 'Bloomberg Television',
    description: 'Global business and financial news',
    youtubeId: 'OlUMDZchivQ',
    category: 'Business',
    live: true
  },
  {
    id: '3',
    name: 'CNBC Live',
    description: 'Breaking financial news and market updates',
    youtubeId: 'gCNeDWCI0vo',
    category: 'Markets',
    live: true
  },
  {
    id: '4',
    name: 'Financial News Network',
    description: 'Real-time trading and market analysis',
    youtubeId: 'l8PMl7tUDIE',
    category: 'Trading',
    live: true
  }
];

export function LiveNewsStreams() {
  const [activeChannel, setActiveChannel] = useState<string | null>(null);

  const toggleChannel = (channelId: string) => {
    if (activeChannel === channelId) {
      setActiveChannel(null);
    } else {
      setActiveChannel(channelId);
    }
  };

  const isPlaying = (channelId: string) => activeChannel === channelId;

  const CategoryBadge = ({ category }: { category: string }) => {
    const getVariant = (cat: string) => {
      switch (cat.toLowerCase()) {
        case 'markets': return 'default';
        case 'business': return 'secondary';
        case 'trading': return 'destructive';
        default: return 'outline';
      }
    };

    return (
      <Badge variant={getVariant(category)} className="text-xs">
        {category}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
          <TrendingUp className="w-6 h-6 text-primary" />
          📺 Live Financial News
        </h2>
        <p className="text-muted-foreground">
          24/7 live market coverage from top financial news networks
        </p>
      </div>

      {/* Active Player */}
      {activeChannel && (
        <div className="xr-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Now Streaming</h3>
              <p className="text-sm text-muted-foreground">
                {newsChannels.find(c => c.id === activeChannel)?.name}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveChannel(null)}
            >
              <Pause className="w-4 h-4 mr-2" />
              Stop Stream
            </Button>
          </div>
          
          <div className="aspect-video rounded-lg overflow-hidden bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${newsChannels.find(c => c.id === activeChannel)?.youtubeId}?autoplay=1&mute=0&controls=1&modestbranding=1&rel=0&enablejsapi=1`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              title="Live News Stream"
              frameBorder="0"
            />
          </div>
        </div>
      )}

      {/* Channel Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {newsChannels.map((channel) => (
          <Card 
            key={channel.id} 
            className={`cursor-pointer transition-all duration-300 hover:shadow-lg ${
              isPlaying(channel.id) ? 'ring-2 ring-primary shadow-primary/20' : ''
            }`}
            onClick={() => toggleChannel(channel.id)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <CardTitle className="text-sm font-medium leading-tight">
                    {channel.name}
                  </CardTitle>
                  {channel.live && (
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                      <Badge variant="destructive" className="text-xs px-1 py-0">
                        LIVE
                      </Badge>
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleChannel(channel.id);
                  }}
                >
                  {isPlaying(channel.id) ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {channel.description}
                </p>
                
                <div className="flex items-center justify-between">
                  <CategoryBadge category={channel.category} />
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`https://youtube.com/watch?v=${channel.youtubeId}`, '_blank');
                    }}
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Watch
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info Section */}
      <div className="xr-card p-4">
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Volume2 className="w-4 h-4" />
          <span>All channels provide 24/7 live financial news and market coverage. Click any card to start streaming.</span>
        </div>
      </div>
    </div>
  );
}