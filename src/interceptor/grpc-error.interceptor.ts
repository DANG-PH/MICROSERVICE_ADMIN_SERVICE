import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Observable, catchError, throwError } from 'rxjs';
import { status } from '@grpc/grpc-js';

@Injectable()
export class GrpcErrorInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError(err => {
        // Nếu đã là RpcException thì giữ nguyên
        if (err instanceof RpcException) return throwError(() => err);

        // ServiceError từ downstream → convert
        return throwError(() => new RpcException({
          status: err?.code ?? status.INTERNAL,
          message: err?.details || err?.message || 'Downstream service error',
        }));
      })
    );
  }
}