import { useEffect } from 'react';

interface SEOHeadProps {
  title: string;
  slug: string;
  publishedDate: string;
  description?: string;
}

const SUPABASE_URL = "https://odncvfiuzliyohxrsigc.supabase.co";

export function SEOHead({ title, slug, publishedDate, description }: SEOHeadProps) {
  useEffect(() => {
    const isoDate = new Date(publishedDate).toISOString();
    const pageUrl = `https://xraycrypto.io/marketbrief/${slug}`;
    const ogImageUrl = `${SUPABASE_URL}/functions/v1/generate-og-image?slug=${encodeURIComponent(slug)}`;
    
    // Create Article JSON-LD schema
    const articleSchema = {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": title,
      "datePublished": isoDate,
      "dateModified": isoDate,
      "author": {
        "@type": "Person",
        "name": "XRay",
        "url": "https://x.com/XRayMarkets"
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
      "image": "https://xraycrypto.io/social-preview.jpg"
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

    // Set author meta tags
    setMetaTag('name', 'author', 'XRay');
    setMetaTag('property', 'article:author', 'XRay');
    setMetaTag('property', 'article:published_time', isoDate);
    setMetaTag('property', 'twitter:creator', '@XRayMarkets');
    setMetaTag('property', 'og:type', 'article');
    setMetaTag('property', 'og:title', title);
    setMetaTag('property', 'og:url', pageUrl);
    
    if (description) {
      setMetaTag('property', 'og:description', description);
      setMetaTag('name', 'description', description);
    }

    // Update page title
    const originalTitle = document.title;
    document.title = `${title} | XRayCrypto™`;

    // Cleanup on unmount
    return () => {
      const schema = document.getElementById('article-schema');
      if (schema) schema.remove();
      document.title = originalTitle;
    };
  }, [title, slug, publishedDate, description]);

  return null;
}
