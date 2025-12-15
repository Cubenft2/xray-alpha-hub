import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TradingViewChart } from '@/components/TradingViewChart';
import { ExchangePriceComparison } from '@/components/ExchangePriceComparison';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import {
  TokenHeader,
  TokenPriceMarket,
  TokenTechnicals,
  TokenSocialPulse,
  TokenContracts,
  TokenSecurity,
  TokenNews,
  TokenAISummary,
  TokenDataSources,
} from '@/components/token-detail';

export default function CryptoUniverseDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();

  // Single query to token_cards - the master source of truth
  const { data: tokenCard, isLoading, error } = useQuery({
    queryKey: ['token-card', symbol],
    queryFn: async () => {
      if (!symbol) throw new Error('No symbol provided');

      const { data, error } = await supabase
        .from('token_cards')
        .select('*')
        .eq('canonical_symbol', symbol.toUpperCase())
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    staleTime: 30 * 1000, // 30 seconds fresh
    gcTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false,
    enabled: !!symbol,
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-[400px] w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  // Not found state
  if (!tokenCard) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center space-y-4">
          <AlertTriangle className="h-12 w-12 mx-auto text-destructive" />
          <h2 className="text-2xl font-bold">Token Not Found</h2>
          <p className="text-muted-foreground">
            No data available for "{symbol?.toUpperCase()}" in token_cards.
          </p>
          <Button onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // Parse contracts JSON if present
  const contracts = tokenCard.contracts as Record<string, string> | null;

  // Parse top_news JSON if present
  const topNews = tokenCard.top_news as Array<{
    title: string;
    url?: string;
    source?: string;
    published_at?: string;
    sentiment?: number;
  }> | null;

  // Determine data availability
  const hasPolygonData = tokenCard.polygon_supported === true || tokenCard.rsi_14 !== null;
  const hasLunarCrushData = tokenCard.galaxy_score !== null || tokenCard.alt_rank !== null;
  const hasCoingeckoData = tokenCard.coingecko_id !== null;
  const hasSecurityData = tokenCard.security_score !== null || tokenCard.is_honeypot !== null;

  // Build TradingView symbol
  const getTradingViewSymbol = () => {
    if (tokenCard.polygon_ticker) {
      return `CRYPTO:${tokenCard.canonical_symbol}USD`;
    }
    return `CRYPTO:${tokenCard.canonical_symbol}USD`;
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <TokenHeader
        symbol={tokenCard.canonical_symbol}
        name={tokenCard.name}
        logoUrl={tokenCard.logo_url}
        tier={tokenCard.tier}
        marketCapRank={tokenCard.market_cap_rank}
        categories={tokenCard.categories}
      />

      {/* TradingView Chart */}
      <Card>
        <CardContent className="p-0">
          <TradingViewChart symbol={getTradingViewSymbol()} height="500px" />
        </CardContent>
      </Card>

      {/* Price & Market */}
      <TokenPriceMarket
        priceUsd={tokenCard.price_usd}
        change1hPct={tokenCard.change_1h_pct}
        change24hPct={tokenCard.change_24h_pct}
        change7dPct={tokenCard.change_7d_pct}
        change30dPct={tokenCard.change_30d_pct}
        high24h={tokenCard.high_24h}
        low24h={tokenCard.low_24h}
        athPrice={tokenCard.ath_price}
        atlPrice={tokenCard.atl_price}
        marketCap={tokenCard.market_cap}
        volume24h={tokenCard.volume_24h_usd}
        marketDominance={tokenCard.market_dominance}
        circulatingSupply={tokenCard.circulating_supply}
        totalSupply={tokenCard.total_supply}
        fullyDilutedValuation={tokenCard.fully_diluted_valuation}
      />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Technical Indicators */}
          <TokenTechnicals
            rsi14={tokenCard.rsi_14}
            rsiSignal={tokenCard.rsi_signal}
            macdLine={tokenCard.macd_line}
            macdSignal={tokenCard.macd_signal}
            macdHistogram={tokenCard.macd_histogram}
            macdTrend={tokenCard.macd_trend}
            sma20={tokenCard.sma_20}
            sma50={tokenCard.sma_50}
            sma200={tokenCard.sma_200}
            ema12={tokenCard.ema_12}
            ema26={tokenCard.ema_26}
            priceUsd={tokenCard.price_usd}
            technicalSignal={tokenCard.technical_signal}
            technicalScore={tokenCard.technical_score}
            priceVsSma20={tokenCard.price_vs_sma_20}
            priceVsSma50={tokenCard.price_vs_sma_50}
            priceVsSma200={tokenCard.price_vs_sma_200}
            technicalsUpdatedAt={tokenCard.technicals_updated_at}
          />

          {/* Security Analysis */}
          <TokenSecurity
            securityScore={tokenCard.security_score}
            securityGrade={tokenCard.security_grade}
            isHoneypot={tokenCard.is_honeypot}
            honeypotReason={tokenCard.honeypot_reason}
            buyTax={tokenCard.buy_tax}
            sellTax={tokenCard.sell_tax}
            isOwnershipRenounced={tokenCard.is_ownership_renounced}
            hiddenOwner={tokenCard.hidden_owner}
            canTakeBackOwnership={tokenCard.can_take_back_ownership}
            isMintable={tokenCard.is_mintable}
            isOpenSource={tokenCard.is_open_source}
            isProxy={tokenCard.is_proxy}
            holderCount={tokenCard.holder_count}
            top10HolderPercent={tokenCard.top10_holder_percent}
            isLpLocked={tokenCard.is_lp_locked}
            lpLockUntil={tokenCard.lp_lock_until}
            securityFlags={tokenCard.security_flags}
            securityUpdatedAt={tokenCard.security_updated_at}
          />

          {/* Contracts & Links */}
          <TokenContracts
            contracts={contracts}
            primaryChain={tokenCard.primary_chain}
            website={tokenCard.website}
            twitter={tokenCard.twitter}
            discord={tokenCard.discord}
            telegram={tokenCard.telegram}
            github={tokenCard.github}
            coingeckoId={tokenCard.coingecko_id}
          />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Social Pulse */}
          <TokenSocialPulse
            galaxyScore={tokenCard.galaxy_score}
            altRank={tokenCard.alt_rank}
            sentiment={tokenCard.sentiment}
            sentimentLabel={tokenCard.sentiment_label}
            socialVolume24h={tokenCard.social_volume_24h}
            interactions24h={tokenCard.interactions_24h}
            contributorsActive={tokenCard.contributors_active}
            socialDominance={tokenCard.social_dominance}
            twitterVolume={tokenCard.twitter_volume_24h}
            twitterSentiment={tokenCard.twitter_sentiment}
            redditVolume={tokenCard.reddit_volume_24h}
            redditSentiment={tokenCard.reddit_sentiment}
            youtubeVolume={tokenCard.youtube_volume_24h}
            youtubeSentiment={tokenCard.youtube_sentiment}
            tiktokVolume={tokenCard.tiktok_volume_24h}
            tiktokSentiment={tokenCard.tiktok_sentiment}
            telegramVolume={tokenCard.telegram_volume_24h}
            telegramSentiment={tokenCard.telegram_sentiment}
            socialUpdatedAt={tokenCard.social_updated_at}
          />

          {/* AI Summary */}
          <TokenAISummary
            aiSummary={tokenCard.ai_summary}
            aiSummaryShort={tokenCard.ai_summary_short}
            keyThemes={tokenCard.key_themes}
            notableEvents={tokenCard.notable_events}
            aiUpdatedAt={tokenCard.ai_updated_at}
            tier={tokenCard.tier}
          />

          {/* News */}
          <TokenNews
            topNews={topNews}
            newsUpdatedAt={tokenCard.news_updated_at}
          />
        </div>
      </div>

      {/* Exchange Price Comparison */}
      <ExchangePriceComparison symbol={tokenCard.canonical_symbol} />

      {/* Data Sources Footer */}
      <TokenDataSources
        tier={tokenCard.tier}
        priceUpdatedAt={tokenCard.price_updated_at}
        socialUpdatedAt={tokenCard.social_updated_at}
        technicalsUpdatedAt={tokenCard.technicals_updated_at}
        securityUpdatedAt={tokenCard.security_updated_at}
        newsUpdatedAt={tokenCard.news_updated_at}
        hasPolygonData={hasPolygonData}
        hasLunarCrushData={hasLunarCrushData}
        hasCoingeckoData={hasCoingeckoData}
        hasSecurityData={hasSecurityData}
      />
    </div>
  );
}
