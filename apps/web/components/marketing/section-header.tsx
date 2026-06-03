import { cn } from '../../lib/utils';

interface MarketingSectionHeaderProps {
  tag?: string;
  title: string;
  description?: string;
  className?: string;
  dark?: boolean;
}

export function MarketingSectionHeader({
  tag,
  title,
  description,
  className,
  dark = false,
}: MarketingSectionHeaderProps) {
  return (
    <div className={cn("text-center space-y-3 mb-16", className)}>
      {tag && (
        <span className={cn(
          "text-xs font-bold uppercase tracking-wider block",
          dark ? "text-primary-400" : "text-primary-500"
        )}>
          {tag}
        </span>
      )}
      <h2 className={cn(
        "text-3xl md:text-4xl font-black tracking-tight leading-tight max-w-2xl mx-auto",
        dark ? "text-white" : "text-slate-900"
      )}>
        {title}
      </h2>
      {description && (
        <p className={cn(
          "text-sm sm:text-base max-w-2xl mx-auto leading-relaxed",
          dark ? "text-slate-400" : "text-slate-500"
        )}>
          {description}
        </p>
      )}
    </div>
  );
}
