type NavHrefItem = {
  href: string;
  activeWhen?: string[];
};

export function splitNavHref(href: string): { path: string; hash: string | null } {
  const hashIndex = href.indexOf('#');
  if (hashIndex === -1) {
    return { path: href, hash: null };
  }
  return {
    path: href.slice(0, hashIndex),
    hash: href.slice(hashIndex),
  };
}

/** Scroll in-page when already on the target path; returns true if handled. */
export function scrollToNavHash(href: string): boolean {
  const { path, hash } = splitNavHref(href);
  if (!hash || typeof window === 'undefined') return false;
  if (window.location.pathname !== path) return false;

  const targetId = hash.slice(1);
  const target = document.getElementById(targetId);
  if (!target) return false;

  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.history.pushState(null, '', `${path}${hash}`);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  return true;
}

/**
 * Resolves which nav href is active, including hash anchors on the same path
 * (e.g. Executive Dashboard vs Attention Items on /dashboard).
 */
export function computeActiveNavHref(
  items: NavHrefItem[],
  pathname: string | null,
  hash: string,
): string | null {
  if (!pathname) return null;

  let bestHref: string | null = null;
  let bestScore = -1;

  for (const item of items) {
    const { path: itemPath, hash: itemHash } = splitNavHref(item.href);
    const candidates = item.activeWhen?.length
      ? item.activeWhen.map((candidate) => splitNavHref(candidate).path)
      : [itemPath];

    for (const candidatePath of candidates) {
      let score = -1;

      if (pathname === candidatePath) {
        if (itemHash) {
          if (hash === itemHash) {
            score = candidatePath.length + 20_000;
          }
        } else {
          const hashOwnedByOtherItem = items.some((other) => {
            const otherSplit = splitNavHref(other.href);
            return (
              otherSplit.path === itemPath &&
              otherSplit.hash !== null &&
              otherSplit.hash === hash
            );
          });
          if (!hash || !hashOwnedByOtherItem) {
            score = candidatePath.length + 10_000;
          }
        }
      } else if (
        candidatePath !== '/dashboard' &&
        pathname.startsWith(`${candidatePath}/`)
      ) {
        score = candidatePath.length;
      }

      if (score > bestScore) {
        bestScore = score;
        bestHref = item.href;
      }
    }
  }

  return bestHref;
}
