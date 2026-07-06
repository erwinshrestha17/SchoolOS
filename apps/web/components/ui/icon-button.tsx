import { Button, type ButtonProps } from './button';
import { Tooltip } from './tooltip';

export type IconButtonProps = Omit<ButtonProps, 'size' | 'children'> & {
  /** Required. Used as both the tooltip text and the accessible name. */
  label: string;
  icon: React.ReactNode;
  size?: 'sm' | 'default' | 'lg';
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right';
};

const iconOnlySizeClasses: Record<NonNullable<IconButtonProps['size']>, string> = {
  sm: 'h-8 w-8',
  default: 'h-10 w-10',
  lg: 'h-11 w-11',
};

/**
 * Icon-only button that always carries a tooltip and an accessible name.
 * Never use this for high-risk/financial/destructive/ambiguous actions —
 * those require a visible text label alongside the icon, not just this.
 */
export function IconButton({
  label,
  icon,
  size = 'default',
  tooltipSide = 'top',
  className,
  ...props
}: IconButtonProps) {
  return (
    <Tooltip content={label} side={tooltipSide}>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label={label}
        className={`p-0 ${iconOnlySizeClasses[size]} ${className ?? ''}`}
        {...props}
      >
        {icon}
      </Button>
    </Tooltip>
  );
}
