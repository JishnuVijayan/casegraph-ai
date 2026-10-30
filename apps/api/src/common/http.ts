import { ArgumentsHost, Catch, ExceptionFilter, HttpException, INestApplication, ValidationPipe } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Request, Response } from 'express';
import { cases, users } from '../db/schema';

export type Actor = Pick<typeof users.$inferSelect, 'id' | 'role' | 'organizationId' | 'displayName'>;
export type ApiRequest = Request & {
  requestId: string; actor?: Actor; caseRecord?: typeof cases.$inferSelect; sessionDigest?: string;
};
/** An error whose message is safe, plain language for the person using the app. */
export class PlainError extends HttpException {
  constructor(status: number, readonly userMessage: string, readonly code?: string) { super(userMessage, status); }
}
export function envelope(request: ApiRequest, data: unknown) { return { data, requestId: request.requestId }; }

@Catch()
class ApiErrors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<ApiRequest>();
    const response = http.getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : 500;
    const errors: Record<number, [string, string]> = {
      400: ['BAD_REQUEST', 'Invalid request.'], 401: ['UNAUTHENTICATED', 'Please sign in to continue.'],
      403: ['ACCESS_DENIED', 'Access denied.'], 404: ['NOT_FOUND', 'Route not found.'],
      415: ['UNSUPPORTED_MEDIA_TYPE', 'This file type is not supported. Use PNG, JPEG, WebP, PDF, TXT or DOCX files up to 5 MB.'],
      413: ['PAYLOAD_TOO_LARGE', 'Request too large.'], 429: ['RATE_LIMITED', 'Please try again later.'],
      503: ['UNAVAILABLE', 'This service is temporarily unavailable. Please try again in a moment.'],
    };
    let [code, message] = errors[status] ?? ['INTERNAL_ERROR', 'Request could not be completed.'];
    if (error instanceof PlainError) { message = error.userMessage; code = error.code ?? code; }
    response.status(status).json({ error: { code, message }, requestId: request.requestId });
  }
}

export function configureHttp(app: INestApplication) {
  app.setGlobalPrefix('api/v1');
  app.use((request: ApiRequest, response: Response, next: () => void) => {
    request.requestId = randomUUID();
    response.setHeader('X-Request-ID', request.requestId);
    response.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.useGlobalFilters(new ApiErrors());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
}
