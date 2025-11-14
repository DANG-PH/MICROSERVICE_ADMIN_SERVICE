import { Injectable, Inject, Logger } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import {
  ChangeEmailRequest,
  GetEmailUserRequest,
  AUTH_PACKAGE_NAME,
  AUTH_SERVICE_NAME,
  AuthServiceClient,
} from 'proto/auth.pb';
import { winstonLogger } from 'src/logger/logger.config'; 
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private authGrpcService: AuthServiceClient;

  constructor(
    @Inject(AUTH_PACKAGE_NAME) private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.authGrpcService = this.client.getService<AuthServiceClient>(AUTH_SERVICE_NAME);
  }

  async handleChangeEmail(req: ChangeEmailRequest) {
    return firstValueFrom(this.authGrpcService.changeEmail(req));
  }

  async handleGetEmail(req: GetEmailUserRequest) {
    return firstValueFrom(this.authGrpcService.getEmailUser(req));
  }
}

/*

Đây KHÔNG phải hàm local.
Đây là proxy function được ClientGrpc auto-generate từ proto.
Hàm này không xử lý logic, mà chỉ pack request và chuẩn bị gọi gRPC.

Khi subscribe xảy ra:

✔ gRPC client serialize dữ liệu thành binary theo proto3

Nó convert req thành Buffer dựa trên ChangeEmailRequest trong .pb file.

✔ Tạo HTTP/2 request (vì gRPC chạy trên HTTP/2)

Method: POST

Path: /<package>.<service>/ChangeEmail
Ví dụ:

/auth.AuthService/ChangeEmail


Header đặc biệt:

content-type: application/grpc
grpc-encoding: identity
grpc-timeout: <nếu có>

✔ Tạo một gRPC stream trên TCP

gRPC luôn chạy qua TCP + HTTP/2.

Mỗi RPC là một HTTP/2 stream.

✔ Mã hóa (serialize) request body thành binary frame

gRPC có format riêng:
compressedFlag | messageLength | messagePayload


Ví dụ bạn có:

const obs$ = this.authGrpcService.changeEmail(req);
return firstValueFrom(obs$);


Về bản chất, nó tương đương:

const obs$ = this.authGrpcService.changeEmail(req);

return new Promise((resolve, reject) => {
  const sub = obs$.subscribe({
    next: (value) => {
      resolve(value);
      sub.unsubscribe();
    },
    error: (err) => {
      reject(err);
      sub.unsubscribe();
    },
    complete: () => {
      // nếu observable complete mà không có value -> throw error
      reject(new EmptyError());
    }
  });
});


Tức là firstValueFrom() đã tự làm tất cả: subscribe → lấy value đầu tiên → unsubscribe → trả Promise.
*/