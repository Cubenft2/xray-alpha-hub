import { RefObject, useState } from 'react';
import { toast } from 'sonner';

interface UseAISummaryShareOptions {
  symbol: string;
  type: 'headline' | 'summary' | 'insights';
  text: string;
}

export function useAISummaryShare(
  ref: RefObject<HTMLElement>,
  options: UseAISummaryShareOptions
) {
  const [isExporting, setIsExporting] = useState(false);

  const generateImage = async (): Promise<Blob | null> => {
    if (!ref.current) return null;

    try {
      const html2canvas = (await import('html2canvas')).default;
      
      // Show watermark during export
      const watermark = ref.current.querySelector('[data-watermark]') as HTMLElement;
      if (watermark) watermark.style.display = 'flex';

      const canvas = await html2canvas(ref.current, {
        backgroundColor: '#0a0a0a',
        scale: 2,
        logging: false,
        useCORS: true,
      });

      // Hide watermark after export
      if (watermark) watermark.style.display = 'none';

      return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png', 1.0);
      });
    } catch (error) {
      console.error('Error generating image:', error);
      return null;
    }
  };

  const handleExportImage = async () => {
    setIsExporting(true);
    try {
      const blob = await generateImage();
      if (!blob) {
        toast.error('Failed to generate image');
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${options.symbol}-ai-${options.type}-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Image downloaded!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to download image');
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = async () => {
    setIsExporting(true);
    
    // Build share URLs immediately (synchronous)
    const shareUrl = `${window.location.origin}/crypto-universe/${options.symbol}`;
    const shareText = `${options.text} | @XRayMarkets ${shareUrl}`;
    const xUrl = `https://x.com/intent/post?text=${encodeURIComponent(shareText)}`;
    
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    // Detect if we're in an iframe (preview environment)
    let isInIframe = false;
    try {
      isInIframe = window.self !== window.top;
    } catch {
      isInIframe = true; // Cross-origin iframe
    }
    
    // Helper to open X immediately with multiple fallback strategies
    const openXNow = (url: string): boolean => {
      // Try 1: window.open with popup dimensions
      const popup = window.open(url, '_blank', 'noopener,noreferrer,width=550,height=420');
      if (popup) return true;
      
      // Try 2: window.open without dimensions (new tab)
      const tab = window.open(url, '_blank', 'noopener,noreferrer');
      if (tab) return true;
      
      // Try 3: Anchor click trick
      try {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        // Can't verify if this worked, assume success
        return true;
      } catch {
        // Anchor trick failed
      }
      
      // Try 4: Same-tab navigation (last resort)
      try {
        window.location.assign(url);
        return true;
      } catch {
        return false;
      }
    };
    
    // MOBILE: Open X immediately, then try native share
    if (isMobile) {
      const opened = openXNow(xUrl);
      if (opened) {
        toast.success('Opening X...');
      } else if (isInIframe) {
        toast.info('Share blocked in preview. Open in new tab to share.');
      } else {
        toast.error('Could not open X. Check popup settings.');
      }
      setIsExporting(false);
      return;
    }
    
    // DESKTOP: Open X immediately FIRST, then do image/clipboard work
    const opened = openXNow(xUrl);
    
    if (!opened) {
      if (isInIframe) {
        toast.info('Share blocked in preview. Open app in new tab to share.');
      } else {
        toast.error('Popup blocked. Allow popups for this site.');
      }
      setIsExporting(false);
      return;
    }

    // X is now opening - do best-effort image generation + clipboard
    try {
      const blob = await generateImage();
      
      let clipboardSuccess = false;
      if (blob && navigator.clipboard?.write) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          clipboardSuccess = true;
        } catch {
          // Clipboard failed silently
        }
      }

      if (clipboardSuccess) {
        toast.success('X opened! Image copied - paste it in your tweet!');
      } else {
        toast.success('X opened! Use Download to save the image.');
      }
    } catch (error) {
      console.error('Share error:', error);
      toast.info('X opened! Image generation failed.');
    } finally {
      setIsExporting(false);
    }
  };

  return {
    isExporting,
    handleExportImage,
    handleShare,
  };
}
