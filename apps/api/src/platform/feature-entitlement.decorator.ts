import { SetMetadata } from '@nestjs/common';

export const FEATURE_ENTITLEMENTS_KEY = 'feature_entitlements';

export const RequiresFeature = (...featureKeys: string[]) =>
  SetMetadata(FEATURE_ENTITLEMENTS_KEY, featureKeys);
