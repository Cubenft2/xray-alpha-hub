import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SEOHead } from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { 
  COTDataSection, 
  MetalPriceHero, 
  KeyStatsGrid, 
  MarketVerdict, 
  ChartToggle,
  ShareButtons
} from '@/components/forex-detail';

type MetalType = 'silver' | 'gold' | 'platinum' | 'palladium';

interface MetalConfig {
  forexPair: string;
  cotCommodity: string;
  futuresUnderlying: string;
  name: string;
  icon: string;
}

const METAL_CONFIG: Record<MetalType, MetalConfig> = {
  silver: {
    forexPair: 'XAGUSD',
    cotCommodity: 'SILVER',
    futuresUnderlying: 'XAG',
    name: 'Silver',
    icon: '🥈'
  },
  gold: {
    forexPair: 'XAUUSD',
    cotCommodity: 'GOLD',
    futuresUnderlying: 'XAU',
    name: 'Gold',
    icon: '🥇'
  },
  platinum: {
    forexPair: 'XPTUSD',
    cotCommodity: 'PLATINUM',
    futuresUnderlying: 'XPT',
    name: 'Platinum',
    icon: '⚪'
  },
  palladium: {
    forexPair: 'XPDUSD',
    cotCommodity: 'PALLADIUM',
    futuresUnderlying: 'XPD',
    name: 'Palladium',
    icon: '🔘'
  }
};

export default function ForexDetail() {
  const { metal } = useParams<{ metal: string }>();
  const navigate = useNavigate();

  // Validate metal parameter
  const validMetals = ['silver', 'gold', 'platinum', 'palladium'];
  const validMetal = validMetals.includes(metal || '') ? metal as MetalType : null;
  const config = validMetal ? METAL_CONFIG[validMetal] : null;

  // Fetch spot price from forex_cards
  const { data: forexData, isLoading: forexLoading } = useQuery({
    queryKey: ['forex-detail', config?.forexPair],
    queryFn: async () => {
      if (!config) return null;
      const { data, error } = await supabase
        .from('forex_cards')
        .select('*')
        .eq('pair', config.forexPair)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!config,
    refetchInterval: 30000,
  });

  // Fetch COT data (last 10 weeks for trends)
  const { data: cotData, isLoading: cotLoading } = useQuery({
    queryKey: ['cot-reports', config?.cotCommodity],
    queryFn: async () => {
      if (!config) return null;
      const { data, error } = await supabase
        .from('cot_reports')
        .select('*')
        .eq('commodity', config.cotCommodity)
        .order('report_date', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!config,
  });

  // Fetch futures metadata
  const { data: futuresData, isLoading: futuresLoading } = useQuery({
    queryKey: ['futures-detail', config?.futuresUnderlying],
    queryFn: async () => {
      if (!config) return null;
      const { data, error } = await supabase
        .from('futures_cards')
        .select('*')
        .eq('underlying', config.futuresUnderlying)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!config,
  });

  // Invalid metal parameter
  if (!validMetal || !config) {
    return (
      <>
        <SEOHead title="Metal Not Found" description="Invalid metal specified" />
        <div className="py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Metal Not Found</h1>
          <p className="text-muted-foreground mb-6">
            Valid options are{' '}
            <Link to="/forex/gold" className="text-primary hover:underline">gold</Link>,{' '}
            <Link to="/forex/silver" className="text-primary hover:underline">silver</Link>,{' '}
            <Link to="/forex/platinum" className="text-primary hover:underline">platinum</Link>, or{' '}
            <Link to="/forex/palladium" className="text-primary hover:underline">palladium</Link>.
          </p>
          <Button onClick={() => navigate('/forex')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Forex
          </Button>
        </div>
      </>
    );
  }

  // Dynamic OG image for social sharing
  const ogImageUrl = `https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/generate-forex-og-image?metal=${validMetal}`;

  return (
    <>
      <SEOHead
        title={`${config.name} Deep Dive - COT Positioning & Analysis`}
        description={`Comprehensive ${config.name.toLowerCase()} market analysis with CFTC Commitment of Traders positioning data, bank shorts, speculator longs, and technical indicators.`}
        ogImageUrl={ogImageUrl}
        canonicalUrl={`https://xraycrypto.io/forex/${validMetal}`}
        keywords={`${config.name.toLowerCase()} price, ${config.forexPair}, COT report, precious metals, CFTC positioning, bank shorts`}
      />
      
      <div className="py-6 space-y-6">
        {/* Header */}
        <div className="container mx-auto">
          <div className="flex items-center justify-between mb-6">
            <Button variant="ghost" size="sm" onClick={() => navigate('/forex')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Forex
            </Button>
            <ShareButtons metal={validMetal} price={forexData?.rate} metalName={config.name} />
          </div>

          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl">{config.icon}</span>
            <h1 className="text-3xl font-bold">{config.name} Deep Dive</h1>
          </div>
          <p className="text-muted-foreground">
            CFTC positioning data, futures analysis, and market intelligence
          </p>
        </div>

        {/* Price Hero */}
        <div className="container mx-auto">
          <MetalPriceHero 
            forexData={forexData} 
            isLoading={forexLoading} 
            metal={validMetal} 
          />
        </div>

        {/* Key Stats Grid */}
        <div className="container mx-auto">
          <KeyStatsGrid
            cotData={cotData?.[0] || null}
            futuresData={futuresData}
            isLoading={cotLoading || futuresLoading}
            metal={validMetal}
          />
        </div>

        {/* Chart with Spot/Futures Toggle - defer until forex data ready */}
        {!forexLoading && (
          <div className="container mx-auto">
            <ChartToggle metal={validMetal} />
          </div>
        )}

        {/* COT Positioning Data */}
        <div className="container mx-auto">
          <COTDataSection 
            cotData={cotData || null} 
            isLoading={cotLoading} 
            metal={validMetal} 
          />
        </div>

        {/* Market Analysis / Verdict */}
        <div className="container mx-auto">
          <MarketVerdict
            cotData={cotData?.[0] || null}
            forexData={forexData}
            metal={validMetal}
          />
        </div>

        {/* Data Sources Footer */}
        <div className="container mx-auto">
          <div className="text-center text-xs text-muted-foreground space-y-1">
            <p>Spot prices: Polygon.io | COT data: CFTC (updated weekly, Fridays)</p>
            <p>Futures data: COMEX | Analysis: Automated, not financial advice</p>
          </div>
        </div>
      </div>
    </>
  );
}
