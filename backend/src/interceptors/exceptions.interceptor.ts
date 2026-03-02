import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import * as winston from 'winston';

@Injectable()
export class ExceptionsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        winston.error('Exception caught', {
          message: error.message,
          stack: error.stack,
          context: context.getClass().name,
          path: context.switchToHttp().getRequest().url,
        });

        return throwError(() => {
          // Preserve original error structure for Nest's exception filters
          if (error instanceof Error) {
            return error;
          }
          return new Error(error);
        });
      }),
    );
  }
}
