'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CarouselSlide {
  src: string;
  alt: string;
  label: string;
}

const slides: CarouselSlide[] = [
  {
    src: '/manager-dashboard.png',
    alt: 'Property Manager Dashboard Overview',
    label: 'Dashboard Overview',
  },
  {
    src: '/manager-tenants.png',
    alt: 'Tenant Management Table',
    label: 'Tenant Management',
  },
  {
    src: '/manager-payments.png',
    alt: 'Rent Payment Tracking',
    label: 'Payment Tracking',
  },
  {
    src: '/manager-maintenance.png',
    alt: 'Maintenance Request Management',
    label: 'Maintenance Tickets',
  },
];

export function DashboardCarousel(): React.ReactElement {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const goToSlide = useCallback((index: number): void => {
    setActiveIndex(index);
  }, []);

  const goToNext = useCallback((): void => {
    setActiveIndex((prev) => (prev + 1) % slides.length);
  }, []);

  // Auto-advance every 4 seconds
  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(goToNext, 4000);
    return () => clearInterval(timer);
  }, [isPaused, goToNext]);

  // Calculate positions for the stacked card layout
  const getCardStyle = (index: number): { zIndex: number; x: number; y: number; scale: number; opacity: number; rotateY: number } => {
    const diff = (index - activeIndex + slides.length) % slides.length;

    if (diff === 0) {
      // Active card — front and center
      return { zIndex: 30, x: 0, y: 0, scale: 1, opacity: 1, rotateY: 0 };
    } else if (diff === 1) {
      // Next card — offset right and behind
      return { zIndex: 20, x: 80, y: 16, scale: 0.92, opacity: 0.7, rotateY: -5 };
    } else if (diff === slides.length - 1) {
      // Previous card — offset left and behind
      return { zIndex: 10, x: -80, y: 16, scale: 0.92, opacity: 0.7, rotateY: 5 };
    } else {
      // Hidden cards
      return { zIndex: 0, x: 0, y: 32, scale: 0.85, opacity: 0, rotateY: 0 };
    }
  };

  return (
    <div
      className="relative w-full"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Cards container */}
      <div className="relative h-[320px] sm:h-[360px] md:h-[400px]" style={{ perspective: '1200px' }}>
        {slides.map((slide, index) => {
          const style = getCardStyle(index);
          return (
            <motion.div
              key={slide.src}
              className="absolute inset-0 cursor-pointer"
              animate={{
                x: style.x,
                y: style.y,
                scale: style.scale,
                opacity: style.opacity,
                rotateY: style.rotateY,
                zIndex: style.zIndex,
              }}
              transition={{
                type: 'spring',
                stiffness: 260,
                damping: 30,
              }}
              onClick={() => goToSlide(index)}
            >
              <div className="w-full h-full rounded-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                <img
                  src={slide.src}
                  alt={slide.alt}
                  className="w-full h-full object-cover object-top"
                  draggable={false}
                />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Slide label */}
      <AnimatePresence mode="wait">
        <motion.p
          key={activeIndex}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="text-center mt-6 text-sm font-medium text-slate-500 dark:text-slate-400"
        >
          {slides[activeIndex].label}
        </motion.p>
      </AnimatePresence>

      {/* Dot indicators */}
      <div className="flex justify-center items-center space-x-2 mt-3">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            aria-label={`Go to slide ${index + 1}`}
            className="relative p-1 group"
          >
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                index === activeIndex
                  ? 'w-8 bg-indigo-600 dark:bg-indigo-400'
                  : 'w-2 bg-slate-300 dark:bg-slate-600 group-hover:bg-slate-400 dark:group-hover:bg-slate-500'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
