export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNIQUE_CONSTRAINT_VIOLATION'
  | 'FOREIGN_KEY_CONSTRAINT_VIOLATION'
  | 'RECORD_NOT_FOUND'
  | 'HTTP_ERROR'
  | 'INTERNAL_SERVER_ERROR';

export type ApiErrorResponse = {
  statusCode: number;
  code: ApiErrorCode;
  message: string;
  details: unknown;
  path: string;
  requestId: string;
  timestamp: string;
};
