'use client';

import { Header, type HeaderProps } from './header';

export type TopBarProps = HeaderProps;

export function TopBar(props: TopBarProps) {
  return <Header {...props} />;
}
