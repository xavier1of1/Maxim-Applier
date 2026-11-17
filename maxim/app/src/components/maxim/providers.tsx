'use client';

import type {ReactNode} from 'react';
import Link from 'next/link';
import {Theme} from '@astryxdesign/core/theme';
import {LinkProvider} from '@astryxdesign/core/Link';
import {neutralTheme} from '@astryxdesign/theme-neutral/built';

export function Providers({children}: {children: ReactNode}) {
  return <Theme theme={neutralTheme} mode="light">
    <LinkProvider component={Link}>{children}</LinkProvider>
  </Theme>;
}
