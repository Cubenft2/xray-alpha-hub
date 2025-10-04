import { useRef, useEffect } from 'react';

interface UseMarqueeOptions {
  pxPerSecond?: number;
  pause?: boolean;
}

export function useMarquee({ pxPerSecond = 50, pause = false }: UseMarqueeOptions = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const widthRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rafRef = useRef<number>();
  const speedRef = useRef(pxPerSecond);

  useEffect(() => {
    speedRef.current = pxPerSecond;
  }, [pxPerSecond]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    // Measure the width of the first group including gap
    const measureWidth = () => {
      const firstGroup = track.firstElementChild as HTMLElement;
      if (firstGroup) {
        const cs = getComputedStyle(track);
        const gap = parseFloat(cs.columnGap || cs.gap || '0') || 0;
        const newWidth = firstGroup.offsetWidth + gap;
        
        if (newWidth > 0 && newWidth !== widthRef.current) {
          // Preserve animation progress when width changes
          const prev = widthRef.current || newWidth;
          const progress = prev > 0 ? offsetRef.current / prev : 0;
          widthRef.current = newWidth;
          offsetRef.current = progress * newWidth;
        }
      }
    };

    // Initial measurement
    measureWidth();

    // Watch for size changes
    const resizeObserver = new ResizeObserver(() => {
      measureWidth();
    });

    if (track.firstElementChild) {
      resizeObserver.observe(track.firstElementChild as HTMLElement);
    }

    // Animation loop
    const animate = (currentTime: number) => {
      if (!pause && document.visibilityState === 'visible') {
        if (lastTimeRef.current) {
          const deltaTime = (currentTime - lastTimeRef.current) / 1000; // Convert to seconds
          offsetRef.current += deltaTime * speedRef.current;

          // Wrap seamlessly when we've scrolled past one full group
          if (widthRef.current > 0 && offsetRef.current >= widthRef.current) {
            offsetRef.current -= widthRef.current;
          }

          if (track) {
            track.style.transform = `translate3d(-${offsetRef.current}px, 0, 0)`;
          }
        }
        lastTimeRef.current = currentTime;
      } else if (pause) {
        // Reset lastTime when paused so we don't get a big jump when resuming
        lastTimeRef.current = 0;
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    // Handle visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        lastTimeRef.current = 0;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pause]);

  return { containerRef, trackRef };
}
