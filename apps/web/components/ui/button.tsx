import * as React from "react"
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  isLoading?: boolean;
}

export function Button({ className, variant = 'default', size = 'default', isLoading, children, disabled, ...props }: ButtonProps) {
  const baseStyles = "inline-flex items-center justify-center whitespace-nowrap rounded-2xl text-sm font-bold ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]";
  
  const variants = {
    default: "bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)] shadow-sm",
    outline: "border-2 border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
    ghost: "hover:bg-slate-100 hover:text-slate-900",
    link: "text-slate-900 underline-offset-4 hover:underline",
    destructive: "bg-rose-600 text-white hover:bg-rose-700 shadow-sm",
  };

  const sizes = {
    default: "h-11 px-6 py-2.5",
    sm: "h-9 rounded-xl px-4",
    lg: "h-13 rounded-3xl px-10 text-base",
    icon: "h-10 w-10 p-0",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading...
        </span>
      ) : children}
    </button>
  )
}
