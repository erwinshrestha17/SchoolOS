import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterTenantDto } from './register-tenant.dto';

describe('RegisterTenantDto admin password strength (DEF-01)', () => {
  const base = {
    name: 'Green Valley School',
    slug: 'green-valley',
    adminEmail: 'admin@greenvalley.com',
  };

  it('accepts a strong admin password', async () => {
    const dto = plainToInstance(RegisterTenantDto, {
      ...base,
      adminPassword: 'RootAccess1!',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each([
    ['too short', 'Ab1!x'],
    ['no uppercase', 'password1!'],
    ['no lowercase', 'PASSWORD1!'],
    ['no digit', 'Password!!'],
    ['no symbol', 'Password11'],
  ])('rejects a weak admin password (%s)', async (_label, adminPassword) => {
    const dto = plainToInstance(RegisterTenantDto, {
      ...base,
      adminPassword,
    });

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });

  it('rejects an invalid slug', async () => {
    const dto = plainToInstance(RegisterTenantDto, {
      ...base,
      slug: 'Green Valley!',
      adminPassword: 'RootAccess1!',
    });

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });
});
