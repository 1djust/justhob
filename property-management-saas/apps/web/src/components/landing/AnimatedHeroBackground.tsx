'use client';
import { motion } from 'framer-motion';

export function AnimatedHeroBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden z-0">
      {/* Animated cinematic background image with Ken Burns panning effect */}
      <motion.div
        animate={{ 
          scale: [1, 1.1, 1],
          x: ['0%', '-2%', '0%'],
          y: ['0%', '-1%', '0%']
        }}
        transition={{ 
          duration: 30, 
          repeat: Infinity, 
          ease: "linear" 
        }}
        className="absolute -inset-10"
      >
        <img 
          src="/images/assets/hero-bg.png?v=2" 
          alt="" 
          className="w-full h-full object-cover"
        />
      </motion.div>
      
      {/* Dark overlay so text remains readable */}
      <div className="absolute inset-0 bg-slate-950/50" />
      
      {/* Bottom fade into the next section */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white dark:to-slate-950" />
    </div>
  );
}
