import * as React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "success" | "accent" | "ghost" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-bold transition-all disabled:opacity-50 disabled:pointer-events-none active:scale-95";

    const variants = {
      primary:
        "bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 shadow-xl hover:scale-[1.02]",
      secondary:
        "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700",
      danger:
        "bg-rose-600 text-white hover:bg-rose-700 shadow-sm",
      success:
        "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
      accent:
        "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
      ghost:
        "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800",
      outline:
        "border border-zinc-200 bg-transparent hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-800",
    };

    const sizes = {
      sm: "px-4 py-2 text-xs rounded-lg gap-1.5",
      md: "px-6 py-3 text-sm rounded-full gap-2",
      lg: "px-10 py-4 text-base rounded-full gap-3 tracking-widest",
      icon: "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
