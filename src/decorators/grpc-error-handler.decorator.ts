// decorators/grpc-error-handler.decorator.ts
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';

export function GrpcErrorHandler() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (err: any) {
        if (err instanceof RpcException) throw err; // giữ nguyên
        throw new RpcException({
          status: status.NOT_FOUND,
          message: err?.details || err?.message || 'Internal error',
        });
      }
    };

    return descriptor;
  };
}