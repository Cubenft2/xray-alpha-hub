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
    name: 'Peaceful Piano',
    description: 'Beautiful piano music for relaxation',
    youtubeId: 'lTRiuFIWV54',
    category: 'Piano',
    live: true
  },
  {
    id: '4',
    name: 'Deep Focus Music',
    description: 'Background music for deep work sessions',
    youtubeId: '36YnV9STBqc',
    category: 'Focus',
    live: true
  },
  {
    id: '5',
    name: 'Jazz Café',
    description: 'Smooth jazz for relaxed atmosphere',
    youtubeId: 'Dx5qFachd3A',
    category: 'Jazz',
    live: true
  },
  {
    id: '6',
    name: 'Ambient Study',
    description: 'Atmospheric sounds for concentration',
    youtubeId: 'lFcSrYw-ARY',
    category: 'Ambient',
    live: true
  },
  {
    id: '7',
    name: 'Synthwave Radio',
    description: 'Retro synthwave & cyberpunk vibes',
    youtubeId: '4xDzrJKXOOY',
    category: 'Synthwave',
    live: true
  },
  {
    id: '8',
    name: 'Ambient Soundscape',
    description: 'Peaceful ambient sounds for focus',
    youtubeId: 'lFcSrYw-ARY',
    category: 'Ambient',
    live: true
  },
  {
    id: '9',
    name: 'Nature Sounds',
    description: 'Forest sounds and natural ambience',
    youtubeId: 'rlt81BfVXi4',
    category: 'Nature',
    live: true
  },
  {
    id: '10',
    name: 'Study With Me',
    description: 'Productive study atmosphere',
    youtubeId: 'f02mOEt11OQ',
    category: 'Study',
    live: true
  },
  {
    id: '11',
    name: 'Reggae Vibes',
    description: 'Smooth reggae beats for relaxation',
    youtubeId: 'i5d-r6RbNNk',
    category: 'Reggae',
    live: true
  },
  {
    id: '12',
    name: 'Reggae Chill',
    description: 'Classic reggae rhythms',
    youtubeId: 'e76DpWphneg',
    category: 'Reggae',
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
        case 'reggae': return 'secondary';
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
              src={`https://www.youtube.com/embed/${chillChannels.find(c => c.id === activeChannel)?.youtubeId}?autoplay=1&mute=0&controls=1&modestbranding=1&rel=0&enablejsapi=1`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              title="Chill Zone Player"
              frameBorder="0"
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