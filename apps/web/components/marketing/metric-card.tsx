import { cn } from '../../lib/utils';
import { NumberTicker } from './number-ticker';

interface MetricCardProps {
  label: string;
  value: number | string;
  prefix?: string;
  suffix?: string;
  formatter?: (val: number) => string;
  textColor?: string;
  className?: string;
}

export function MetricCard({
  label,
  value,
  prefix,
  suffix,
  formatter,
  textColor = "text-white",
  className,
}: MetricCardProps) {
  return (
    <div className={cn(
      "bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3 space-y-1 hover:border-slate-700 transition-colors",
      className
    )}>
      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">{label}</span>
      <div className={cn("text-lg font-black leading-tight", textColor)}>
        {typeof value === 'string' ? (
          value
        ) : (
          <>
            {prefix && <span className="text-xs font-semibold text-slate-400">{prefix}</span>}
            <NumberTicker value={value} formatter={formatter} />
            {suffix && <span className="text-xs font-semibold text-slate-400">{suffix}</span>}
          </>
        )}
      </div>
    </div>
  );
}
