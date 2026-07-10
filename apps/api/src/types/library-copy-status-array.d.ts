import type { LibraryCopyStatus } from '@prisma/client';

export {};

declare global {
  interface ReadonlyArray<T> {
    includes(searchElement: T | LibraryCopyStatus, fromIndex?: number): boolean;
  }

  interface Array<T> {
    includes(searchElement: T | LibraryCopyStatus, fromIndex?: number): boolean;
  }

  type DateConstructor = new (
    value: string | number | Date | undefined,
  ) => Date;
}
