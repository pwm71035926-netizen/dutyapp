import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import { Loader2, ArrowDown } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  /** Pull distance (px) required to trigger refresh */
  threshold?: number;
  /** Maximum pull distance (px) */
  maxPull?: number;
}

export function PullToRefresh({
  onRefresh,
  children,
  threshold = 80,
  maxPull = 130,
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const canPull = useCallback(() => {
    // Only allow pull when scrolled to the very top
    return window.scrollY <= 0;
  }, []);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!canPull() || isRefreshing) return;
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    },
    [canPull, isRefreshing]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!pulling.current || isRefreshing) return;
      const currentY = e.touches[0].clientY;
      const diff = currentY - startY.current;

      if (diff > 0 && canPull()) {
        // Apply diminishing resistance as you pull further
        const resistance = Math.min(diff * 0.45, maxPull);
        setPullDistance(resistance);
        // Prevent default scrolling while pulling
        if (resistance > 10) {
          e.preventDefault();
        }
      } else {
        setPullDistance(0);
      }
    },
    [canPull, isRefreshing, maxPull]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(threshold * 0.6); // Snap to loading position
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, threshold, isRefreshing, onRefresh]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // passive: false is needed to allow preventDefault on touchmove
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const progress = Math.min(pullDistance / threshold, 1);
  const showIndicator = pullDistance > 10 || isRefreshing;

  return (
    <div ref={containerRef} className="relative">
      {/* Pull indicator */}
      <div
        className="fixed left-1/2 -translate-x-1/2 z-[60] flex items-center justify-center pointer-events-none"
        style={{
          top: `calc(env(safe-area-inset-top, 0px) + ${Math.max(pullDistance - 20, 0)}px)`,
          opacity: showIndicator ? 1 : 0,
          transition: pulling.current
            ? 'opacity 0.15s ease'
            : 'all 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shadow-xl ${
            isRefreshing || progress >= 1
              ? 'bg-indigo-600 text-white shadow-indigo-200'
              : 'bg-white text-indigo-600 shadow-gray-200 border border-gray-100'
          }`}
          style={{
            transform: `scale(${0.6 + progress * 0.4})`,
            transition: pulling.current
              ? 'background-color 0.2s, color 0.2s'
              : 'all 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}
        >
          {isRefreshing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <ArrowDown
              className="w-5 h-5 transition-transform duration-200"
              style={{
                transform: `rotate(${progress >= 1 ? 180 : 0}deg)`,
              }}
            />
          )}
        </div>
      </div>

      {/* Content with pull offset */}
      <div
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: pulling.current
            ? 'none'
            : 'transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
