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
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
    
    // Open popup IMMEDIATELY before any async work (preserves user gesture)
    let popup: Window | null = null;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (!isMobile) {
      popup = window.open('about:blank', '_blank', 'width=550,height=420');
      if (!popup) {
        // Popup blocked - fallback to same-tab navigation
        toast.info('Opening X in this tab...');
        window.location.href = twitterUrl;
        setIsExporting(false);
        return;
      }
    }

    try {
      const blob = await generateImage();

      // Mobile: Try native share with image
      if (isMobile && blob && navigator.share) {
        try {
          const file = new File([blob], `${options.symbol}-ai-${options.type}.png`, { type: 'image/png' });
          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({ text: shareText, files: [file] });
            toast.success('Shared!');
            return;
          }
        } catch {
          // Native share failed, fallback to opening Twitter
        }
        // Fallback: open Twitter on mobile
        window.open(twitterUrl, '_blank');
        toast.success('Opening X...');
        return;
      }

      // Desktop: Copy image to clipboard (best-effort)
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

      // Navigate the already-opened popup to Twitter
      if (popup) {
        popup.location.href = twitterUrl;
        if (clipboardSuccess) {
          toast.success('Opening X... Image copied - paste it in your tweet!');
        } else {
          toast.success('Opening X... Use Download to save the image.');
        }
      }
    } catch (error) {
      console.error('Share error:', error);
      // Still navigate popup if it exists
      if (popup) {
        popup.location.href = twitterUrl;
        toast.info('Opening X... Image generation failed.');
      } else {
        toast.error('Failed to share');
      }
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
