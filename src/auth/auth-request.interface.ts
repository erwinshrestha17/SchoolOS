import { type Request } from 'express';
import { type AuthContext } from './auth.types';

export interface AuthenticatedRequest extends Request {
  auth?: AuthContext;
}
