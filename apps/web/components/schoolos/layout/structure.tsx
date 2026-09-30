import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Phase 3C canonical structure primitives (SCHOOLOS_WEB_DESIGN_ASTRA §4.2, §5.1).
 *
 *   Surface  neutral grouped work area — border, no shadow
 *   Section  lightweight structural grouping with a heading — no container chrome
 *   Panel    contextual side/secondary region
 *   Card     a DISCRETE OBJECT only (a class, a notice, an event)
 *
 * A card is not the default container: ordinary operational structure uses
 * Surface/Section. Geometry comes from the v2 tokens (rounded-surface,
 * px-gutter...) so pages cannot drift into arbitrary radii or shadows.
 */

type Heading = {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Heading level for the title; Sections inside a page default to h2. */
  headingLevel?: 2 | 3 | 4;
};

function HeadingRow({
  title,
  description,
  actions,
  headingLevel = 2,
  id,
}: Heading & { id?: string }) {
  if (!title && !description && !actions) return null;
  const Tag = `h${headingLevel}` as 'h2' | 'h3' | 'h4';
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {title ? (
          <Tag id={id} className="text-card-title text-[var(--ink)]">
            {title}
          </Tag>
        ) : null}
        {description ? (
          <p className="mt-0.5 text-helper text-[var(--muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export type SurfaceProps = HTMLAttributes<HTMLElement> &
  Heading & {
    /** `flush` removes inner padding for edge-to-edge tables/lists. */
    padding?: 'default' | 'flush';
    as?: 'section' | 'div';
    /** Secondary actions/links below the content, separated by a divider. */
    footer?: ReactNode;
  };

export function Surface({
  title,
  description,
  actions,
  headingLevel,
  padding = 'default',
  as: Tag = 'section',
  footer,
  className,
  children,
  ...rest
}: SurfaceProps) {
  return (
    <Tag
      data-schoolos-ui="surface"
      className={cn(
        'rounded-surface border border-[var(--line)] bg-white',
        padding === 'default' && 'p-gutter-compact md:p-gutter',
        // Edge-to-edge tables/lists stay inside the rounded border.
        padding === 'flush' && 'overflow-hidden',
        className,
      )}
      {...rest}
    >
      {title || description || actions ? (
        <div className={cn(padding === 'flush' && 'p-gutter-compact', 'mb-4')}>
          <HeadingRow
            title={title}
            description={description}
            actions={actions}
            headingLevel={headingLevel}
          />
        </div>
      ) : null}
      {children}
      {footer ? (
        <div
          className={cn(
            'mt-4 border-t border-[var(--line)] pt-4',
            padding === 'flush' && 'px-gutter-compact pb-4',
          )}
        >
          {footer}
        </div>
      ) : null}
    </Tag>
  );
}

export type SectionProps = HTMLAttributes<HTMLElement> &
  Heading & {
    /** Adds a top divider to separate sibling sections without cards. */
    divided?: boolean;
  };

export function Section({
  title,
  description,
  actions,
  headingLevel,
  divided = false,
  className,
  children,
  id,
  ...rest
}: SectionProps) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section
      id={id}
      data-schoolos-ui="section"
      aria-labelledby={title ? headingId : undefined}
      className={cn(
        'space-y-3',
        divided && 'border-t border-[var(--line)] pt-5',
        className,
      )}
      {...rest}
    >
      <HeadingRow
        id={headingId}
        title={title}
        description={description}
        actions={actions}
        headingLevel={headingLevel}
      />
      {children}
    </section>
  );
}

export type PanelProps = HTMLAttributes<HTMLElement> &
  Heading & { tone?: 'neutral' | 'subtle' };

export function Panel({
  title,
  description,
  actions,
  headingLevel = 3,
  tone = 'subtle',
  className,
  children,
  ...rest
}: PanelProps) {
  return (
    <aside
      data-schoolos-ui="panel"
      className={cn(
        'rounded-surface border border-[var(--line)] p-4',
        tone === 'subtle' ? 'bg-slate-50' : 'bg-white',
        className,
      )}
      {...rest}
    >
      {title || actions ? (
        <div className="mb-3">
          <HeadingRow
            title={title}
            description={description}
            actions={actions}
            headingLevel={headingLevel}
          />
        </div>
      ) : null}
      {children}
    </aside>
  );
}

export type CardProps = HTMLAttributes<HTMLElement> &
  Heading & { interactive?: boolean };

/** Discrete object only. Do not use as a page-section wrapper. */
export function Card({
  title,
  description,
  actions,
  headingLevel = 3,
  interactive = false,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <article
      data-schoolos-ui="card"
      className={cn(
        'rounded-surface border border-[var(--line)] bg-white p-4',
        interactive &&
          'transition-colors hover:border-[var(--primary)] focus-within:border-[var(--primary)]',
        className,
      )}
      {...rest}
    >
      {title || actions ? (
        <div className="mb-2">
          <HeadingRow
            title={title}
            description={description}
            actions={actions}
            headingLevel={headingLevel}
          />
        </div>
      ) : null}
      {children}
    </article>
  );
}
