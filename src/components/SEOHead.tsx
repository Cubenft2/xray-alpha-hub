import { useEffect } from 'react';

interface SEOHeadProps {
  title: string;
  slug?: string;
  publishedDate?: string;
  description?: string;
  ogImageUrl?: string;
  canonicalUrl?: string;
  ogType?: string;
  keywords?: string;
  noIndex?: boolean;
}

export function SEOHead({ 
  title, 
  slug, 
  publishedDate, 
  description, 
  ogImageUrl,
  canonicalUrl,
  ogType = 'website',
  keywords,
  noIndex = false
}: SEOHeadProps) {
  useEffect(() => {
    // Helper to create/update meta tags
    const setMetaTag = (attribute: string, value: string, content: string) => {
      let meta = document.querySelector(`meta[${attribute}="${value}"]`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attribute, value);
        document.head.appendChild(meta);
      }
      meta.content = content;
    };

    // Helper to create/update link tags
    const setLinkTag = (rel: string, href: string) => {
      let link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = rel;
        document.head.appendChild(link);
      }
      link.href = href;
    };

    // Update page title
    const originalTitle = document.title;
    document.title = `${title} | XRayCrypto™`;

    // Set basic meta tags
    if (description) {
      setMetaTag('name', 'description', description);
      setMetaTag('property', 'og:description', description);
      setMetaTag('name', 'twitter:description', description);
    }
    setMetaTag('property', 'og:title', title);
    setMetaTag('name', 'twitter:title', title);
    setMetaTag('property', 'og:type', ogType);
    setMetaTag('property', 'og:site_name', 'XRayCrypto™');

    // Set canonical URL
    if (canonicalUrl) {
      setLinkTag('canonical', canonicalUrl);
      setMetaTag('property', 'og:url', canonicalUrl);
    }

    // Set keywords
    if (keywords) {
      setMetaTag('name', 'keywords', keywords);
    }

    // Set noindex for private pages
    if (noIndex) {
      setMetaTag('name', 'robots', 'noindex, nofollow');
    }

    // If custom OG image is provided, use it
    if (ogImageUrl) {
      setMetaTag('property', 'og:image', ogImageUrl);
      setMetaTag('property', 'og:image:width', '1200');
      setMetaTag('property', 'og:image:height', '630');
      setMetaTag('property', 'og:image:type', 'image/png');
      setMetaTag('name', 'twitter:card', 'summary_large_image');
      setMetaTag('name', 'twitter:image', ogImageUrl);
    }

    // Only add article schema if we have slug and publishedDate (for market briefs)
    if (slug && publishedDate) {
      const isoDate = new Date(publishedDate).toISOString();
      const pageUrl = `https://xraycrypto.io/marketbrief/${slug}`;
      const briefOgImageUrl = `https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/generate-og-image?slug=${slug}`;

      const articleSchema = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": title,
        "datePublished": isoDate,
        "dateModified": isoDate,
        "author": {
          "@type": "Person",
          "name": "XRay",
          "url": "https://x.com/xrayzone"
        },
        "publisher": {
          "@type": "Organization",
          "name": "XRayCrypto™",
          "url": "https://xraycrypto.io",
          "logo": {
            "@type": "ImageObject",
            "url": "https://xraycrypto.io/zoobie-pfp.webp"
          }
        },
        "mainEntityOfPage": {
          "@type": "WebPage",
          "@id": pageUrl
        },
        "image": briefOgImageUrl
      };

      // Create and inject JSON-LD script
      const schemaScript = document.createElement('script');
      schemaScript.type = 'application/ld+json';
      schemaScript.id = 'article-schema';
      schemaScript.textContent = JSON.stringify(articleSchema);
      
      // Remove existing article schema if present
      const existingSchema = document.getElementById('article-schema');
      if (existingSchema) {
        existingSchema.remove();
      }
      document.head.appendChild(schemaScript);

      // Set article-specific meta tags
      setMetaTag('name', 'author', 'XRay');
      setMetaTag('property', 'article:author', 'XRay');
      setMetaTag('property', 'article:published_time', isoDate);
      setMetaTag('property', 'twitter:creator', '@xrayzone');
      setMetaTag('name', 'twitter:site', '@xrayzone');
      setMetaTag('property', 'og:type', 'article');
      setMetaTag('property', 'og:url', pageUrl);
      
      // Only set brief OG image if no custom ogImageUrl provided
      if (!ogImageUrl) {
        setMetaTag('property', 'og:image', briefOgImageUrl);
        setMetaTag('property', 'og:image:width', '1200');
        setMetaTag('property', 'og:image:height', '630');
        setMetaTag('property', 'og:image:type', 'image/png');
        setMetaTag('name', 'twitter:card', 'summary_large_image');
        setMetaTag('name', 'twitter:image', briefOgImageUrl);
      }
    } else if (!slug && !publishedDate) {
      // Add WebPage schema for non-article pages
      const webPageSchema = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": title,
        "description": description || '',
        "url": canonicalUrl || 'https://xraycrypto.io',
        "publisher": {
          "@type": "Organization",
          "name": "XRayCrypto™",
          "url": "https://xraycrypto.io",
          "logo": {
            "@type": "ImageObject",
            "url": "https://xraycrypto.io/zoobie-pfp.webp"
          }
        },
        "isPartOf": {
          "@type": "WebSite",
          "name": "XRayCrypto™",
          "url": "https://xraycrypto.io"
        }
      };

      const schemaScript = document.createElement('script');
      schemaScript.type = 'application/ld+json';
      schemaScript.id = 'webpage-schema';
      schemaScript.textContent = JSON.stringify(webPageSchema);
      
      const existingSchema = document.getElementById('webpage-schema');
      if (existingSchema) {
        existingSchema.remove();
      }
      document.head.appendChild(schemaScript);
    }

    // Cleanup on unmount
    return () => {
      if (slug && publishedDate) {
        const schema = document.getElementById('article-schema');
        if (schema) schema.remove();
      } else {
        const schema = document.getElementById('webpage-schema');
        if (schema) schema.remove();
      }
      document.title = originalTitle;
      
      // Remove canonical if we added it
      if (canonicalUrl) {
        const canonical = document.querySelector('link[rel="canonical"]');
        if (canonical) canonical.remove();
      }
      
      // Remove noindex if we added it
      if (noIndex) {
        const robots = document.querySelector('meta[name="robots"]');
        if (robots) robots.remove();
      }
    };
  }, [title, slug, publishedDate, description, ogImageUrl, canonicalUrl, ogType, keywords, noIndex]);

  return null;
}
