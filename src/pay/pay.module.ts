import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { PAY_PACKAGE_NAME } from 'proto/pay.pb';
import { PayService } from './pay.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: PAY_PACKAGE_NAME,
        transport: Transport.GRPC,
        options: {
          package: PAY_PACKAGE_NAME,
          protoPath: join(process.cwd(), 'proto/pay.proto'),
          url: "localhost:50055",
          loader: {
                keepCase: true,
                objects: true,
                arrays: true,
          },
        },
      },
    ]),
  ],
  controllers: [],
  providers: [PayService],
  exports: [PayService]
})
export class PayModule {}
