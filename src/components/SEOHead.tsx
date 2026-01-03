import { useEffect } from 'react';

interface SEOHeadProps {
  title: string;
  slug?: string;
  publishedDate?: string;
  description?: string;
  ogImageUrl?: string;
}

export function SEOHead({ title, slug, publishedDate, description, ogImageUrl }: SEOHeadProps) {
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
    }

    // Cleanup on unmount
    return () => {
      if (slug && publishedDate) {
        const schema = document.getElementById('article-schema');
        if (schema) schema.remove();
      }
      document.title = originalTitle;
    };
  }, [title, slug, publishedDate, description, ogImageUrl]);

  return null;
}
