import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

export interface AuthorizationRouteInventory {
  file: string;
  controller: string;
  handler: string;
  method: string;
  prefix: string;
  path: string;
  guards: string[];
  permissions: string[];
  roles: string[];
  servicePolicy?: string;
  calls: string[];
}
const decorators = (node: ts.Node): Record<string, string[]> =>
  Object.fromEntries(
    (ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : []).map(
      (d) => {
        const e = d.expression;
        return [
          ts.isCallExpression(e) ? e.expression.getText() : e.getText(),
          ts.isCallExpression(e)
            ? e.arguments.map((a) => a.getText().replace(/^['"]|['"]$/g, ''))
            : [],
        ];
      },
    ),
  );
function controllerFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? controllerFiles(join(dir, e.name))
      : e.name.endsWith('.controller.ts')
        ? [join(dir, e.name)]
        : [],
  );
}
/** Fresh AST inventory; no stale report or git-index dependency in CI. */
export function inventoryAuthorizationRoutes(
  src: string,
): AuthorizationRouteInventory[] {
  const rows: AuthorizationRouteInventory[] = [];
  for (const file of controllerFiles(src)) {
    const sf = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    for (const cl of sf.statements.filter(ts.isClassDeclaration)) {
      const cd = decorators(cl);
      if (!cd.Controller) continue;
      for (const m of cl.members) {
        if (!ts.isMethodDeclaration(m)) continue;
        const md = decorators(m);
        const verb = [
          'Get',
          'Post',
          'Put',
          'Patch',
          'Delete',
          'Head',
          'Options',
          'All',
        ].find((v) => md[v]);
        if (!verb) continue;
        rows.push({
          file: file.substring(src.length + 1),
          controller: cl.name?.text ?? '',
          handler: m.name.getText(),
          method: verb.toUpperCase(),
          prefix: cd.Controller[0] ?? '',
          path: md[verb][0] ?? '',
          guards: [...(cd.UseGuards ?? []), ...(md.UseGuards ?? [])],
          permissions: md.Permissions ?? cd.Permissions ?? [],
          roles: md.Roles ?? cd.Roles ?? [],
          servicePolicy: md.ServiceAuthorization?.[0],
          calls: [
            ...(m.body?.getText().matchAll(/this\.([\w]+)\.([\w]+)\(/g) ?? []),
          ].map((match) => `${match[1]}.${match[2]}`),
        });
      }
    }
  }
  return rows.sort((a, b) =>
    `${a.controller}.${a.handler}`.localeCompare(
      `${b.controller}.${b.handler}`,
    ),
  );
}
