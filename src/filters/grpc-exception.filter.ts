// import { Catch, ArgumentsHost } from '@nestjs/common';
// import { RpcException } from '@nestjs/microservices';
// import { BaseRpcExceptionFilter } from '@nestjs/microservices';
// import { ServiceError } from '@grpc/grpc-js';
// import { throwError } from 'rxjs';

// @Catch() 
// export class GrpcExceptionFilter extends BaseRpcExceptionFilter {
//   catch(exception: unknown, host: ArgumentsHost) {
//     if (
//       typeof exception === 'object' &&
//       exception !== null &&
//       'code' in exception
//     ) {
//       const err = exception as ServiceError;

//       console.log(err.code);
//       console.log(err.details);
//       return throwError(() => ({
//         code: err.code,
//         message: err.details || err.message,
//       }));
//     }

//     return super.catch(exception, host);
//   }
// }