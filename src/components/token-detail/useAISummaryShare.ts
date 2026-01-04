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
    try {
      const blob = await generateImage();
      const shareUrl = `${window.location.origin}/crypto-universe/${options.symbol}`;
      const shareText = `${options.text} | @XRayMarkets ${shareUrl}`;

      // Try native share with image (mobile)
      if (blob && navigator.share && navigator.canShare?.({ files: [new File([blob], 'share.png', { type: 'image/png' })] })) {
        const file = new File([blob], `${options.symbol}-ai-${options.type}.png`, { type: 'image/png' });
        await navigator.share({
          text: shareText,
          files: [file],
        });
        toast.success('Shared!');
        return;
      }

      // Desktop: Copy image to clipboard silently, then open Twitter
      if (blob && navigator.clipboard?.write) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
        } catch {
          // Clipboard failed, continue anyway
        }
      }

      // Always open Twitter intent on desktop
      const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
      window.open(twitterUrl, '_blank', 'width=550,height=420');
      
      if (blob) {
        toast.success('Opening Twitter... Image copied - paste it in your tweet!');
      } else {
        toast.success('Opening Twitter...');
      }
    } catch (error) {
      console.error('Share error:', error);
      toast.error('Failed to share');
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
