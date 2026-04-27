import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const { method, url, ip } = req;
    const handler = context.getHandler().name;
    const controller = context.getClass().name;

    console.log(
      '[Backend]',
      method,
      url,
      '->',
      controller + '.' + handler,
      ip ? `(${ip})` : '',
    );

    return next.handle().pipe(
      tap({
        next: () => {
          console.log('[Backend]', method, url, '-> 200 OK');
        },
        error: (err) => {
          const status = err?.status ?? err?.statusCode ?? '?';
          console.log(
            '[Backend]',
            method,
            url,
            '->',
            status,
            err?.message ?? err,
          );
        },
      }),
    );
  }
}
