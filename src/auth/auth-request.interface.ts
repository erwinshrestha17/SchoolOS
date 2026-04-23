import { Request } from 'express';
import { AuthContext } from './auth.types';

export interface AuthenticatedRequest extends Request {
  auth?: AuthContext;
}
