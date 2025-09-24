import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Share, Copy, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MarketBrief {
  slug: string;
  date: string;
  title: string;
  summary: string;
  article_html: string;
  last_word?: string;
  social_text?: string;
  sources?: Array<{ url: string; label?: string }>;
  focus_assets?: string[];
  og_image?: string;
  author: string;
  canonical: string;
}

export default function MarketBriefHome() {
  const { date } = useParams();
  const [brief, setBrief] = useState<MarketBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const { toast } = useToast();

  const workerBase = 'https://xraycrypto-news.xrprat.workers.dev/';

  useEffect(() => {
    const fetchBrief = async () => {
      try {
        setLoading(true);
        console.log('🐕 XRay: Fetching market brief...', date ? `for date: ${date}` : 'latest');
        
        // If we have a date parameter, fetch that specific brief
        if (date) {
          const dateRes = await fetch(`${workerBase}marketbrief/${date}.json`, { 
            cache: 'no-store',
            headers: {
              'Accept': 'application/json',
            }
          });
          
          if (dateRes.ok) {
            const briefData = await dateRes.json();
            console.log('🐕 XRay: Date-specific brief loaded!', briefData);
            setBrief(briefData);
            
            if (briefData.title) {
              document.title = briefData.title + ' — XRayCrypto News';
            }
            return;
          } else {
            throw new Error(`Brief for ${date} not found`);
          }
        }
        
        // Otherwise fetch the latest brief
        const directRes = await fetch(`${workerBase}marketbrief/latest.json`, { 
          cache: 'no-store',
          headers: {
            'Accept': 'application/json',
          }
        });
        
        if (directRes.ok) {
          const briefData = await directRes.json();
          console.log('🐕 XRay: Brief loaded successfully!', briefData);
          setBrief(briefData);
          
          if (briefData.title) {
            document.title = briefData.title + ' — XRayCrypto News';
          }
          return;
        }
        
        console.log('🐕 XRay: Direct endpoint failed, trying feed method...');
        
        // Fallback to the original method
        const feedRes = await fetch(`${workerBase}marketbrief/feed/index.json`, { 
          cache: 'no-store' 
        });
        
        if (!feedRes.ok) throw new Error('Feed fetch failed');
        
        const feed = await feedRes.json();
        if (!feed?.latest) throw new Error('No latest brief available');

        // Fetch the actual brief content
        const briefRes = await fetch(`${workerBase}marketbrief/briefs/${feed.latest}.json`, {
          cache: 'no-store'
        });
        
        if (!briefRes.ok) throw new Error('Brief fetch failed');
        
        const briefData = await briefRes.json();
        setBrief(briefData);
        
        // Update document title and meta
        if (briefData.title) {
          document.title = briefData.title + ' — XRayCrypto News';
        }
        
      } catch (error) {
        console.error('🐕 XRay: Brief load failed:', error);
        toast({
          title: "Connection Issue",  
          description: `Can't reach XRay servers: ${error}`,
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchBrief();
  }, [toast, workerBase, date]);

  const handleShareX = () => {
    if (!brief) return;
    
    // Use the current domain instead of the canonical URL from the API
    const currentDomain = window.location.origin;
    const correctUrl = `${currentDomain}/marketbrief/${brief.slug || brief.date}`;
    
    const shareText = `Let's talk about something.\n\n${brief.title} — ${brief.date}`;
    
    const url = new URL('https://twitter.com/intent/tweet');
    url.searchParams.set('text', shareText);
    url.searchParams.set('url', correctUrl);
    window.open(url.toString(), '_blank', 'noopener');
  };

  const handleCopyLink = async () => {
    if (!brief) return;
    
    // Use the current domain instead of the canonical URL from the API
    const currentDomain = window.location.origin;
    const correctUrl = `${currentDomain}/marketbrief/${brief.slug || brief.date}`;
    
    try {
      await navigator.clipboard.writeText(correctUrl);
      setCopiedToClipboard(true);
      setTimeout(() => setCopiedToClipboard(false), 2000);
      toast({
        title: "Link copied!",
        description: "Brief link copied to clipboard.",
      });
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const handleNativeShare = async () => {
    if (!brief) return;
    
    // Use the current domain instead of the canonical URL from the API
    const currentDomain = window.location.origin;
    const correctUrl = `${currentDomain}/marketbrief/${brief.slug || brief.date}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: brief.title,
          text: `Let's talk about something.\n\n${brief.summary || brief.title}`,
          url: correctUrl
        });
      } catch (error) {
        console.error('Native share failed:', error);
        // When native share fails, copy link instead
        try {
          await navigator.clipboard.writeText(correctUrl);
          toast({
            title: "Link copied!",
            description: "Share unavailable, but link copied to clipboard.",
          });
        } catch (clipboardError) {
          console.error('Clipboard fallback failed:', clipboardError);
          toast({
            title: "Share failed",
            description: "Please copy the URL manually from your browser.",
            variant: "destructive"
          });
        }
      }
    } else {
      // When native share is not supported, copy link instead
      handleCopyLink();
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="max-w-4xl mx-auto">
          <Card className="xr-card">
            <CardContent className="p-8 text-center">
              <div className="animate-pulse">
                <div className="h-8 bg-muted rounded mb-4"></div>
                <div className="h-4 bg-muted rounded mb-2"></div>
                <div className="h-4 bg-muted rounded w-3/4 mx-auto"></div>
              </div>
              <p className="text-muted-foreground mt-4">Loading latest market brief...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="container mx-auto py-6">
        <div className="max-w-4xl mx-auto">
          <Card className="xr-card">
            <CardContent className="p-8 text-center">
              <h2 className="text-xl font-semibold mb-4">Brief Unavailable</h2>
              <p className="text-muted-foreground">Couldn't load the market brief. Please try again shortly.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-3xl font-bold xr-gradient-text">Market Brief</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleShareX}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Share on X
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopyLink}>
              <Copy className="w-4 h-4 mr-2" />
              {copiedToClipboard ? 'Copied!' : 'Copy Link'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleNativeShare}>
              <Share className="w-4 h-4 mr-2" />
              Share
            </Button>
          </div>
        </div>

        {/* Main Brief Card */}
        <Card className="xr-card overflow-hidden">
          {/* Cover Image */}
          {brief.og_image && (
            <div 
              className={`relative aspect-video w-full bg-gradient-to-br from-primary/10 to-background overflow-hidden ${
                imageLoaded ? 'block' : 'hidden'
              }`}
            >
              <img 
                src={brief.og_image}
                alt={brief.title}
                className="w-full h-full object-cover"
                loading="lazy"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageLoaded(false)}
              />
            </div>
          )}

          <CardContent className="p-6 lg:p-8">
            {/* Title and Summary */}
            <div className="space-y-4 mb-6 relative">
              <h2 className="text-2xl lg:text-3xl font-bold leading-tight xr-gradient-text xr-xray-glow animate-pulse">
                {brief.title}
              </h2>
              {brief.summary && (
                <p className="text-muted-foreground text-lg leading-relaxed">
                  {brief.summary}
                </p>
              )}
            </div>

            {/* Article Content */}
            <div className="prose prose-invert max-w-none mb-6">
              {!brief.article_html?.toLowerCase().includes("let's talk about something") && (
                <p className="italic text-muted-foreground mb-2">Let's talk about something.</p>
              )}
              <div dangerouslySetInnerHTML={{ __html: brief.article_html }} />
            </div>

            {/* Last Word */}
            {brief.last_word && (
              <div className="border-l-4 border-primary pl-4 mb-6">
                <p className="italic text-muted-foreground">
                  {brief.last_word}
                </p>
              </div>
            )}

            {/* Sources */}
            {brief.sources && brief.sources.length > 0 && (
              <details className="mb-6 border-t border-border pt-4">
                <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Sources
                </summary>
                <ul className="mt-3 space-y-1 pl-4">
                  {brief.sources.map((source, index) => (
                    <li key={index}>
                      <a 
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        {source.label || source.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {/* Inline Share Buttons */}
            <div className="flex items-center gap-3 pt-4 border-t border-border">
              <Button onClick={handleShareX} size="sm">
                Share on X
              </Button>
              <Button variant="outline" onClick={handleCopyLink} size="sm">
                Copy Link
              </Button>
            </div>
          </CardContent>

          {/* Watermark Footer with Prominent Stamp */}
          <div className="px-6 lg:px-8 pb-6 relative">
            {/* Prominent watermark stamp for sharing */}
            <div className="absolute top-4 right-4 opacity-10 pointer-events-none">
              <img 
                src="/xray-dog.png" 
                alt="XRayCrypto Watermark" 
                className="w-24 h-24 lg:w-32 lg:h-32"
              />
            </div>
            
            <div className="flex items-center justify-between text-sm text-muted-foreground bg-accent/20 rounded-lg p-4 relative z-10">
              <div className="flex items-center gap-3">
                <img 
                  src="/pfp.png" 
                  alt="XRayCrypto" 
                  className="w-8 h-8 rounded-md border border-primary/20"
                />
                <div className="flex flex-col">
                  <span className="font-semibold text-foreground">© XRayCrypto News</span>
                  <span className="text-xs opacity-80">xraycrypto.com</span>
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium text-foreground">{brief.date}</div>
                <div className="text-xs opacity-80">Market Brief</div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}