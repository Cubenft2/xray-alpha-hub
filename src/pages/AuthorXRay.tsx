import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink, FileText, Calendar, User, Archive } from 'lucide-react';
import { format } from 'date-fns';

interface Brief {
  slug: string;
  title: string;
  published_at: string | null;
  brief_type: string;
}

export default function AuthorXRay() {
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Inject JSON-LD Person schema
    const schema = {
      "@context": "https://schema.org",
      "@type": "Person",
      "name": "XRay",
      "url": "https://xraycrypto.io/author/xray",
      "sameAs": ["https://x.com/XRayMarkets"],
      "jobTitle": "Founder & Market Analyst",
      "worksFor": {
        "@type": "Organization",
        "name": "XRayCrypto™",
        "url": "https://xraycrypto.io"
      },
      "description": "XRay is the creator of XRayCrypto™ and author of the daily market briefs. Combining AI-powered analysis with real-time market data to make crypto intelligence accessible.",
      "image": "https://xraycrypto.io/zoobie-pfp.webp"
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'author-schema';
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    // Update page title and meta
    const originalTitle = document.title;
    document.title = 'XRay - Author | XRayCrypto™';

    const metaDescription = document.querySelector('meta[name="description"]');
    const originalDescription = metaDescription?.getAttribute('content') || '';
    if (metaDescription) {
      metaDescription.setAttribute('content', 'XRay is the creator of XRayCrypto™ and author of the daily market briefs. Combining AI-powered analysis with real-time market data.');
    }

    return () => {
      document.getElementById('author-schema')?.remove();
      document.title = originalTitle;
      if (metaDescription) {
        metaDescription.setAttribute('content', originalDescription);
      }
    };
  }, []);

  useEffect(() => {
    async function fetchBriefs() {
      // Calculate date 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('market_briefs')
        .select('slug, title, published_at, brief_type')
        .eq('is_published', true)
        .gte('published_at', thirtyDaysAgo.toISOString())
        .order('published_at', { ascending: false });

      if (!error && data) {
        setBriefs(data);
      }
      setLoading(false);
    }

    fetchBriefs();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Author Profile Section */}
      <Card className="xr-card mb-8">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
            {/* Profile Image Placeholder */}
            <div className="flex-shrink-0">
              <img
                src="/zoobie-pfp.webp"
                alt="XRay - Author"
                className="w-32 h-32 pixel-border animate-zoobie-glow"
              />
            </div>

            {/* Profile Info */}
            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                <User className="w-5 h-5 text-primary" />
                <Badge variant="secondary">Author</Badge>
              </div>
              
              <h1 className="text-3xl md:text-4xl font-bold xr-gradient-text mb-2">
                XRay
              </h1>
              
              <p className="text-lg text-muted-foreground mb-4">
                Founder & Market Analyst
              </p>
              
              <p className="text-foreground/80 mb-6 max-w-xl">
                XRay is the creator of XRayCrypto™ and author of the daily market briefs. 
                Combining AI-powered analysis with real-time market data to make crypto 
                intelligence accessible.
              </p>

              <Button
                asChild
                variant="outline"
                className="group"
              >
                <a
                  href="https://x.com/XRayMarkets"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-4 h-4 mr-2 fill-current"
                    aria-hidden="true"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  Follow @XRayMarkets
                  <ExternalLink className="w-3 h-3 ml-2 group-hover:animate-wiggle" />
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Briefs Section */}
      <Card className="xr-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-primary" />
            Recent Briefs
            {!loading && (
              <Badge variant="default" className="ml-auto">
                Last 30 Days • {briefs.length} {briefs.length === 1 ? 'Brief' : 'Briefs'}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : briefs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No recent briefs in the last 30 days.
            </p>
          ) : (
            <div className="space-y-2">
              {briefs.map((brief) => (
                <Link
                  key={brief.slug}
                  to={`/marketbrief/${brief.slug}`}
                  className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:border-primary/50 hover:bg-accent/50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    <div>
                      <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                        {brief.title}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="outline" className="text-xs capitalize">
                          {brief.brief_type}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    {brief.published_at
                      ? format(new Date(brief.published_at), 'MMM d, yyyy')
                      : 'Draft'}
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Archive Note */}
          <div className="mt-6 pt-4 border-t border-border/30">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Archive className="w-4 h-4 flex-shrink-0" />
              <span>
                Older briefs are available in our{' '}
                <span className="text-primary font-medium">Research Archive</span>
                {' '}— early experimental content from XRay's development phase.
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
