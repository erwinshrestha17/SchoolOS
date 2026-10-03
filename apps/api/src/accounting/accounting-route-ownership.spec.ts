import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AccountingModule } from './accounting.module';
import { AccountingReportsController } from './accounting-reports.controller';

type Controller = abstract new (...args: never[]) => unknown;

function routesOf(controller: Controller) {
  const base = String(Reflect.getMetadata(PATH_METADATA, controller) ?? '');
  const prototype = controller.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(prototype)
    .filter((name) => name !== 'constructor')
    .flatMap((name) => {
      const handler = prototype[name];
      if (typeof handler !== 'function') return [];
      const path = Reflect.getMetadata(PATH_METADATA, handler) as
        | string
        | undefined;
      const method = Reflect.getMetadata(METHOD_METADATA, handler) as
        | RequestMethod
        | undefined;
      if (path === undefined || method === undefined) return [];
      const full = `/${[base, path]
        .map((part) => part.replace(/^\/+|\/+$/g, ''))
        .filter(Boolean)
        .join('/')}`;
      return [
        { key: `${RequestMethod[method]} ${full}`, controller, handler: name },
      ];
    });
}

/**
 * Phase 7.11a: Express answers with the first matching route, so two
 * controllers declaring the same method+path silently shadow each other. The
 * legacy AccountingController used to shadow the canonical income statement,
 * balance sheet and cash book with an older response shape.
 */
describe('accounting route ownership (Phase 7.11a)', () => {
  const controllers = (Reflect.getMetadata('controllers', AccountingModule) ??
    []) as Controller[];
  const routes = controllers.flatMap(routesOf);

  it('declares every method+path exactly once', () => {
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const route of routes) {
      const owner = `${route.controller.name}.${route.handler}`;
      const previous = seen.get(route.key);
      if (previous) duplicates.push(`${route.key}: ${previous} and ${owner}`);
      else seen.set(route.key, owner);
    }
    expect(duplicates).toEqual([]);
  });

  it.each([
    '/accounting/reports/income-statement',
    '/accounting/reports/balance-sheet',
    '/accounting/reports/cash-book',
  ])('serves GET %s from the canonical reports controller', (path) => {
    const owners = routes.filter((route) => route.key === `GET ${path}`);
    expect(owners).toHaveLength(1);
    expect(owners[0].controller).toBe(AccountingReportsController);
  });
});
