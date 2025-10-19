import { Request } from 'express';

/**
 * Authenticated request with user payload from JWT strategy
 */
export interface AuthRequest extends Request {
  user: {
    _id: { toString(): string };
    userId?: string;
    username: string;
    email?: string;
    avatar?: string;
    streamKey?: string;
    createdAt?: Date;
  };
}

/**
 * Optional auth request (user may not be authenticated)
 */
export interface OptionalAuthRequest extends Request {
  user?: AuthRequest['user'];
}
