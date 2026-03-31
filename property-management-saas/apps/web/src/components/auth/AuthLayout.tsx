'use client';

import * as React from 'react';
import { ThemeToggle } from '../ThemeToggle';

export function AuthLayout({ children, title, subtitle }: { children: React.ReactNode, title: string, subtitle: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background transition-colors duration-300">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <div className="w-full max-w-md bg-white dark:bg-zinc-950 border border-border shadow-sm rounded-xl p-8 transition-colors duration-300">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="text-sm text-zinc-500 max-w-xs mx-auto mt-2">{subtitle}</p>
        </div>
        
        {children}
      </div>
    </div>
  );
}
