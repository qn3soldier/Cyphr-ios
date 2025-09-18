import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from '@/lib/utils';

import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'ghost' | 'destructive' | 'outline' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  asChild?: boolean;
}

const buttonVariants = cva(
  "group inline-flex items-center justify-center whitespace-nowrap rounded-2xl text-sm font-medium transition-all duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 transform hover:scale-105 active:scale-95 relative overflow-hidden",
  {
    variants: {
      variant: {
        default: `
          bg-gradient-to-br from-blue-500/20 via-purple-500/15 to-blue-600/10
          text-white font-semibold tracking-wide
          backdrop-blur-xl border border-white/20
          shadow-lg shadow-blue-500/25
          hover:shadow-xl hover:shadow-purple-500/30
          hover:border-white/30
          hover:bg-gradient-to-br hover:from-blue-500/30 hover:via-purple-500/25 hover:to-blue-600/20
          
          before:absolute before:inset-0 before:rounded-2xl
          before:bg-gradient-to-br before:from-white/20 before:via-transparent before:to-transparent
          before:opacity-0 hover:before:opacity-100
          before:transition-opacity before:duration-300
          
          after:absolute after:top-0 after:left-1/4 after:right-1/4 after:h-px
          after:bg-gradient-to-r after:from-transparent after:via-white/60 after:to-transparent
          after:opacity-60 hover:after:opacity-100
          
          [&>*]:relative [&>*]:z-10
        `,
        destructive: `
          bg-gradient-to-br from-red-500/[0.12] via-red-600/[0.08] to-transparent
          text-red-100 backdrop-blur-xl border border-red-400/30
          shadow-[0_8px_32px_0_rgba(239,68,68,0.25)]
          hover:shadow-[0_8px_32px_0_rgba(239,68,68,0.4)]
        `,
        outline: `
          border-2 border-white/30 bg-gradient-to-br from-white/[0.02] to-transparent
          text-white backdrop-blur-lg 
          shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]
          hover:bg-gradient-to-br hover:from-white/[0.08] hover:to-white/[0.02]
          hover:border-white/50
        `,
        secondary: `
          bg-gradient-to-br from-slate-500/[0.08] via-slate-600/[0.05] to-transparent
          text-slate-100 backdrop-blur-xl border border-slate-400/20
          shadow-[0_8px_32px_0_rgba(100,116,139,0.25)]
        `,
        ghost: `
          text-white/90 hover:bg-gradient-to-br hover:from-white/[0.05] hover:to-transparent
          hover:text-white backdrop-blur-sm border border-transparent
          hover:border-white/10 hover:backdrop-blur-md
        `,
        link: "text-cyan-300 underline-offset-4 hover:underline hover:text-cyan-200 border-transparent",
      },
      size: {
        default: "h-12 px-8 py-3",
        sm: "h-10 rounded-xl px-6 text-xs",
        lg: "h-14 rounded-2xl px-10 text-base",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants }; 