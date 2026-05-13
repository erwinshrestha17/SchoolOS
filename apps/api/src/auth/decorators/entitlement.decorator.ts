import { SetMetadata } from '@nestjs/common';

export const ENTITLEMENT_KEY = 'entitlement';
export const Entitlement = (featureKey: string) => SetMetadata(ENTITLEMENT_KEY, featureKey);
