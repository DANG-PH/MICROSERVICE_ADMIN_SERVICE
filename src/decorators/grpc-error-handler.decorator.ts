// decorators/grpc-error-handler.decorator.ts
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';

export function GrpcErrorHandler() {
  return function (constructor: Function) {
    const methods = Object.getOwnPropertyNames(constructor.prototype);

    methods.forEach(methodName => {
      if (methodName === 'constructor') return;

      // Lấy property descriptor của method
      // Descriptor chứa: value (function), writable, enumerable, configurable
      const descriptor = Object.getOwnPropertyDescriptor(constructor.prototype, methodName);

      // Bỏ qua nếu không có descriptor hoặc không phải function
      // (có thể là getter/setter hoặc property thường)
      if (!descriptor || typeof descriptor.value !== 'function') return;

      // Lưu lại method gốc trước khi override
      // Quan trọng: phải lưu ở đây vì bên dưới sẽ ghi đè descriptor.value
      const originalMethod = descriptor.value;

      // lưu tất cả metadata keys từ method gốc
      const metadataKeys = Reflect.getMetadataKeys(originalMethod);

      // Thay thế method gốc bằng wrapper function
      // Wrapper này có cùng signature (...args) nên transparent với caller
      descriptor.value = async function (...args: any[]) {
        try {
          // Gọi method gốc với đúng context (this) và arguments
          // apply(this, args): this là instance của class (PartnerService),
          // args là array arguments truyền vào method
          return await originalMethod.apply(this, args);
        } catch (err: any) {
          // Nếu là RpcException do chính service tự throw
          // → giữ nguyên, không wrap thêm
          if (err instanceof RpcException) throw err;

          // Nếu là ServiceError từ downstream service (auth-service, pay-service,...)
          // → convert sang RpcException với đúng code để API Gateway parse được
          throw new RpcException({
            code: err?.code ?? status.INTERNAL,           // giữ nguyên gRPC code từ downstream
            message: err?.details || err?.message || 'Internal error', // lấy message sạch từ details
          });
        }
      };

      // restore toàn bộ metadata sang wrapper method
      metadataKeys.forEach(key => {
        const value = Reflect.getMetadata(key, originalMethod);
        Reflect.defineMetadata(key, value, descriptor.value);
      });

      // Ghi đè method trên prototype bằng wrapper mới
      // Tất cả instance của class sẽ dùng wrapper này thay vì method gốc
      Object.defineProperty(constructor.prototype, methodName, descriptor);
    });
  };
}