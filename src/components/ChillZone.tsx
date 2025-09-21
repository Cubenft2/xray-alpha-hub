import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, Volume2, ExternalLink } from 'lucide-react';

interface ChillChannel {
  id: string;
  name: string;
  description: string;
  youtubeId: string;
  category: string;
  live: boolean;
}

const chillChannels: ChillChannel[] = [
  {
    id: '1',
    name: 'Lofi Girl',
    description: 'Lofi hip hop radio - beats to relax/study to',
    youtubeId: 'jfKfPfyJRdk',
    category: 'Lofi',
    live: true
  },
  {
    id: '2',
    name: 'Chillhop Music',
    description: 'Chillhop Radio - jazzy & lofi hip hop beats',
    youtubeId: '5yx6BWlEVcY',
    category: 'Chillhop',
    live: true
  },
  {
    id: '3',
    name: 'Coffee Shop Radio',
    description: 'Coffee shop ambience with smooth jazz',
    youtubeId: '4oStw0r33so',
    category: 'Jazz',
    live: true
  },
  {
    id: '4',
    name: 'Synthwave Radio',
    description: 'Retro synthwave & cyberpunk vibes',
    youtubeId: '4xDzrJKXOOY',
    category: 'Synthwave',
    live: true
  },
  {
    id: '5',
    name: 'Ambient Nature',
    description: 'Peaceful nature sounds for focus',
    youtubeId: 'lFcSrYw-ARY',
    category: 'Ambient',
    live: true
  },
  {
    id: '6',
    name: 'Deep Focus',
    description: 'Deep focus music for productivity',
    youtubeId: '1fueZCTYkpA',
    category: 'Focus',
    live: true
  },
  {
    id: '7',
    name: 'Crypto Beats',
    description: 'Electronic beats for crypto trading',
    youtubeId: '36YnV9STBqc',
    category: 'Electronic',
    live: true
  },
  {
    id: '8',
    name: 'Study Vibes',
    description: 'Calm instrumental music for studying',
    youtubeId: 'DWcJFNfaw9c',
    category: 'Study',
    live: true
  },
  {
    id: '9',
    name: 'Rainy Day Jazz',
    description: 'Smooth jazz with rain sounds',
    youtubeId: 'Dx5qFachd3A',
    category: 'Jazz',
    live: true
  },
  {
    id: '10',
    name: 'Meditation Sounds',
    description: 'Peaceful meditation & mindfulness',
    youtubeId: 'ZiN6t7K7txw',
    category: 'Meditation',
    live: true
  },
  {
    id: '11',
    name: 'Tropical House',
    description: 'Uplifting tropical house vibes',
    youtubeId: 'sTSJYZyouek',
    category: 'House',
    live: true
  },
  {
    id: '12',
    name: 'Noir Jazz Bar',
    description: 'Dark, moody jazz bar atmosphere',
    youtubeId: 'Bx4nRaioQdU',
    category: 'Noir Jazz',
    live: true
  }
];

export function ChillZone() {
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [playingChannels, setPlayingChannels] = useState<Set<string>>(new Set());

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
        case 'lofi': return 'default';
        case 'jazz': return 'secondary';
        case 'synthwave': return 'destructive';
        case 'ambient': return 'outline';
        default: return 'default';
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
        <h1 className="text-3xl font-bold gradient-text">🎵 Chill Zone</h1>
        <p className="text-muted-foreground">
          24/7 background music & ambient sounds for your trading sessions
        </p>
      </div>

      {/* Active Player */}
      {activeChannel && (
        <div className="xr-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Now Playing</h3>
              <p className="text-sm text-muted-foreground">
                {chillChannels.find(c => c.id === activeChannel)?.name}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveChannel(null)}
            >
              <Pause className="w-4 h-4 mr-2" />
              Stop
            </Button>
          </div>
          
          <div className="aspect-video rounded-lg overflow-hidden bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${chillChannels.find(c => c.id === activeChannel)?.youtubeId}?autoplay=1&mute=0&controls=1&modestbranding=1&rel=0`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="Chill Zone Player"
            />
          </div>
        </div>
      )}

      {/* Channel Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {chillChannels.map((channel) => (
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
                    YouTube
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
          <span>All channels are 24/7 live streams. Click any card to start playing.</span>
        </div>
      </div>
    </div>
  );
}