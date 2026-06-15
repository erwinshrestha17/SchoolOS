'use client';

import { Sidebar, type SidebarProps } from './sidebar';

export type GlobalAsideProps = SidebarProps;

export function GlobalAside(props: GlobalAsideProps) {
  return <Sidebar {...props} />;
}
