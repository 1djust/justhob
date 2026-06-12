"use client";

import * as React from "react";
import { ThemeToggle } from "../ThemeToggle";

export function AuthLayout({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  const [activeSlide, setActiveSlide] = React.useState(0);

  const slides = [
    {
      title: "Property\nManager.",
      description: "A comprehensive operating system for modern real estate professionals. Streamline operations, manage leases, and scale your property portfolio with unparalleled efficiency."
    },
    {
      title: "Tenant\nExperience.",
      description: "Empowering tenants with a seamless portal for instant payments, simple maintenance requests, and direct community communication."
    },
    {
      title: "Financial\nClarity.",
      description: "Automated billing, transparent reporting, and streamlined financial tracking designed to optimize modern property portfolios."
    }
  ];

  React.useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-background font-sans selection:bg-primary/30">
      {/* 
        RIGHT SIDE: Massive Typographic Canvas (Asymmetric Tension)
        We place it first in DOM for mobile, but it will be hidden on very small screens.
      */}
      <div className="relative hidden md:flex flex-1 flex-col justify-between overflow-hidden bg-[#060B19] text-white p-12 lg:p-24 z-0">
        {/* CSS Noise for premium texture */}
        <div 
          className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none" 
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
          }}
        ></div>
        <div className="absolute -top-[20%] -right-[10%] w-[70%] h-[70%] rounded-full bg-primary/20 blur-3xl mix-blend-screen pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col space-y-6 max-w-2xl animate-in fade-in slide-in-from-left-8 duration-1000">
          <div className="inline-flex items-center gap-3">
            <img src="/images/assets/logo.png" alt="PropertyStack Logo" className="h-8 w-auto" />
            <span className="text-primary font-bold tracking-widest uppercase text-sm">PropertyStack</span>
          </div>
          
          <div className="flex gap-6 mt-8">
            {/* Vertical Carousel Indicators */}
            <div className="flex flex-col gap-3 mt-3 items-center">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveSlide(idx)}
                  className={`w-1.5 rounded-full transition-all duration-700 ease-out cursor-pointer hover:bg-primary/70 ${
                    activeSlide === idx ? "h-20 bg-primary" : "h-6 bg-primary/20"
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>

            {/* Text Content */}
            <div 
              key={activeSlide} 
              className="animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out fill-mode-both"
            >
              <h1 className="text-5xl lg:text-7xl font-black tracking-tighter leading-[1] text-white whitespace-pre-line">
                {slides[activeSlide].title}
              </h1>
              
              <p className="text-slate-300 text-lg lg:text-xl font-medium max-w-lg leading-relaxed mt-6">
                {slides[activeSlide].description}
              </p>
            </div>
          </div>
        </div>

        {/* Decorative architectural grid lines */}
        <div className="absolute bottom-0 right-0 w-1/2 h-1/2 opacity-10 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(to right, #0066FF 1px, transparent 1px), linear-gradient(to bottom, #0066FF 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}></div>

        {/* Floating Glassmorphic UI Widgets for visual balance */}
        <div className="absolute bottom-12 right-12 hidden lg:flex flex-col gap-6 pointer-events-none animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-500">
          
          {/* Revenue Widget */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-[0_8px_32px_rgba(0,102,255,0.15)] w-72 transform translate-x-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <div className="w-5 h-5 text-primary">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Revenue</div>
                  <div className="text-white font-bold text-xl">$124,500</div>
                </div>
              </div>
              <div className="text-primary text-xs font-bold bg-primary/20 px-2 py-1 rounded-md">+14%</div>
            </div>
            {/* Mini Chart */}
            <div className="flex items-end gap-2 h-12 mt-2">
              <div className="w-full bg-primary/20 rounded-t-sm h-[40%]"></div>
              <div className="w-full bg-primary/30 rounded-t-sm h-[60%]"></div>
              <div className="w-full bg-primary/40 rounded-t-sm h-[45%]"></div>
              <div className="w-full bg-primary/50 rounded-t-sm h-[80%]"></div>
              <div className="w-full bg-primary/70 rounded-t-sm h-[65%]"></div>
              <div className="w-full bg-primary rounded-t-sm h-[100%] shadow-[0_0_15px_rgba(0,102,255,0.5)] relative">
                <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white rounded-full shadow-sm"></div>
              </div>
            </div>
          </div>

          {/* Activity Widget */}
          <div className="bg-[#0A192F]/80 backdrop-blur-xl border border-primary/20 p-4 rounded-2xl shadow-[0_8px_32px_rgba(0,102,255,0.15)] w-64 transform -translate-x-4 flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-full border-2 border-primary bg-primary/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-primary rounded-full border-2 border-[#0A192F]"></div>
            </div>
            <div>
              <div className="text-white text-sm font-bold">New Tenant</div>
              <div className="text-slate-300 text-xs font-medium">Lease agreement signed</div>
            </div>
          </div>

        </div>
      </div>

      {/* 
        LEFT SIDE: The Form Panel (Brutalist, Sharp, High Contrast)
      */}
      <div className="relative w-full md:w-[450px] lg:w-[500px] flex-shrink-0 flex flex-col justify-center px-8 py-12 lg:px-16 bg-background border-r-0 md:border-l-2 border-border z-10 shadow-2xl min-h-screen">
        <div className="absolute top-6 right-6">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-[380px] mx-auto animate-in fade-in slide-in-from-right-8 duration-700 delay-150 fill-mode-both">
          <div className="mb-10">
            <h2 className="text-3xl font-bold tracking-tight text-foreground mb-2">
              {title}
            </h2>
            <p className="text-muted-foreground font-medium">
              {subtitle}
            </p>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
