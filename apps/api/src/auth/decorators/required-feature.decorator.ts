import { SetMetadata } from '@nestjs/common';

export const REQUIRED_FEATURE_KEY = 'required_feature';
export const RequiredFeature = (featureKey: string) =>
  SetMetadata(REQUIRED_FEATURE_KEY, featureKey);
