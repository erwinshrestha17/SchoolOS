import { SetMetadata } from '@nestjs/common';

export const REQUIRED_MODULE_KEY = 'required_module';
export const RequiredModule = (moduleName: string) =>
  SetMetadata(REQUIRED_MODULE_KEY, moduleName);
