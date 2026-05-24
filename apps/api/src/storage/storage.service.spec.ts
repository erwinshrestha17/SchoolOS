import { StorageProvider } from '@prisma/client';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { ConfigService } from '../config/config.service';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  const originalEnv = { ...process.env };
  let tempRoot: string | undefined;

  afterEach(async () => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();

    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
      tempRoot = undefined;
    }
  });

  it('writes and reads local private objects from a bounded storage root', async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'schoolos-storage-'));
    process.env.STORAGE_PROVIDER = 'local';
    process.env.LOCAL_STORAGE_ROOT = tempRoot;
    process.env.LOCAL_STORAGE_PUBLIC_BASE_URL = '/protected-storage';

    const service = new StorageService(new ConfigService());
    const saved = await service.saveBufferObject({
      tenantId: 'tenant-a',
      prefix: 'student-documents',
      fileName: 'profile.pdf',
      contentType: 'application/pdf',
      content: Buffer.from('pdf-body'),
    });

    await expect(service.getObjectBuffer(saved.objectKey)).resolves.toEqual(
      Buffer.from('pdf-body'),
    );
    expect(saved.provider).toBe(StorageProvider.LOCAL);
    expect(saved.objectKey).toMatch(
      /^tenant-a\/student-documents\/[a-f0-9-]+\.pdf$/,
    );
    expect(saved.publicUrl).toBeNull();
    expect(saved.checksumSha256).toHaveLength(64);
  });

  it('rejects unsafe local object keys', async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'schoolos-storage-'));
    process.env.STORAGE_PROVIDER = 'local';
    process.env.LOCAL_STORAGE_ROOT = tempRoot;

    const service = new StorageService(new ConfigService());

    await expect(service.getObjectBuffer('../outside.txt')).rejects.toThrow(
      'Invalid storage object key',
    );
  });

  it('creates short-lived signed local read URLs', async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'schoolos-storage-'));
    process.env.STORAGE_PROVIDER = 'local';
    process.env.LOCAL_STORAGE_ROOT = tempRoot;
    process.env.LOCAL_STORAGE_PUBLIC_BASE_URL = '/protected-storage';
    process.env.STORAGE_SIGNED_READ_URL_TTL_SECONDS = '120';
    process.env.STORAGE_SIGNING_SECRET = 'test-signing-secret';

    const service = new StorageService(new ConfigService());
    const signedUrl = await service.createSignedReadUrl({
      objectKey: 'tenant-a/notices/file.pdf',
    });

    expect(signedUrl).toContain('/protected-storage/');
    expect(signedUrl).toContain('expires=');
    expect(signedUrl).toContain('signature=');
  });

  it('uploads S3-compatible objects through normalized R2 aliases', async () => {
    configureR2Env();
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 200 }));
    const service = new StorageService(new ConfigService());

    const saved = await service.saveBufferObject({
      tenantId: 'tenant-a',
      prefix: 'activity media',
      fileName: 'photo.jpg',
      contentType: 'image/jpeg',
      content: Buffer.from('image-body'),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      `https://account.r2.cloudflarestorage.com/schoolos-assets/${saved.objectKey}`,
    );
    expect(saved.provider).toBe(StorageProvider.R2);
    expect(saved.publicUrl).toBeNull();
    expect(options?.method).toBe('PUT');
    expect(options?.body).toEqual(Buffer.from('image-body'));
    expect(options?.headers).toEqual(
      expect.objectContaining({
        'content-type': 'image/jpeg',
        host: 'account.r2.cloudflarestorage.com',
      }),
    );
    expect(
      String((options?.headers as Record<string, string>).authorization),
    ).toContain('Credential=access-key/');
    expect(
      String((options?.headers as Record<string, string>).authorization),
    ).not.toContain('secret-key');
  });

  it('downloads S3-compatible objects through signed requests', async () => {
    configureR2Env();
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(Buffer.from('object-body'), { status: 200 }),
      );
    const service = new StorageService(new ConfigService());

    await expect(
      service.getObjectBuffer('tenant-a/notices/file.pdf'),
    ).resolves.toEqual(Buffer.from('object-body'));

    expect(fetchMock).toHaveBeenCalledWith(
      'https://account.r2.cloudflarestorage.com/schoolos-assets/tenant-a/notices/file.pdf',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          host: 'account.r2.cloudflarestorage.com',
        }),
      }),
    );
  });

  it('creates bounded S3-compatible signed read URLs', async () => {
    configureR2Env();
    process.env.STORAGE_SIGNED_READ_URL_TTL_SECONDS = '60';
    const service = new StorageService(new ConfigService());

    const signedUrl = await service.createSignedReadUrl({
      objectKey: 'tenant-a/notices/file.pdf',
      expiresInSeconds: 120,
    });

    expect(signedUrl).toContain('X-Amz-Expires=60');
    expect(signedUrl).toContain('X-Amz-Signature=');
    expect(signedUrl).not.toContain('secret-key');
  });

  it('fails closed when R2 credentials are incomplete', async () => {
    process.env.STORAGE_PROVIDER = 'r2';
    process.env.R2_BUCKET = 'schoolos-assets';

    const service = new StorageService(new ConfigService());

    await expect(service.checkReadiness()).rejects.toThrow(
      'OBJECT_STORAGE_ENDPOINT or R2_ENDPOINT is required',
    );
  });
});

function configureR2Env() {
  process.env.STORAGE_PROVIDER = 'r2';
  process.env.R2_BUCKET = 'schoolos-assets';
  process.env.R2_ENDPOINT = 'https://account.r2.cloudflarestorage.com';
  process.env.R2_ACCESS_KEY_ID = 'access-key';
  process.env.R2_SECRET_ACCESS_KEY = 'secret-key';
  process.env.R2_PUBLIC_BASE_URL = 'https://assets.schoolos.test';
}
