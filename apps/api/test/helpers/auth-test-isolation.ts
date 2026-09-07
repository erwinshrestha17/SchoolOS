import { AsyncLocalStorage } from 'node:async_hooks';

// Never inherit DATABASE_URL/.env as test authorization. The caller must opt in
// to an isolated disposable database, not the running development school DB.
export const authTestDatabaseUrl = process.env.SCHOOLOS_AUTH_TEST_DATABASE_URL;
if (authTestDatabaseUrl) {
  const target = new URL(authTestDatabaseUrl);
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
    !/^\/schoolos_auth_recovery_test(?:_[a-z0-9]+)?$/.test(target.pathname)
  ) {
    throw new Error('Auth tests require a dedicated loopback test database.');
  }
}

export class IsolatedAuthCls {
  private readonly storage = new AsyncLocalStorage<Map<string, unknown>>();
  get(key: string) {
    return this.storage.getStore()?.get(key);
  }
  set(key: string, value: unknown) {
    const store = this.storage.getStore();
    if (!store) throw new Error('Test CLS context missing');
    store.set(key, value);
  }
  isActive() {
    return this.storage.getStore() !== undefined;
  }
  run<T>(fn: () => Promise<T>) {
    return this.storage.run(new Map(this.storage.getStore()), fn);
  }
}
