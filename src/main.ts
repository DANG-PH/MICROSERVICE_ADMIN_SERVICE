import * as dotenv from 'dotenv';
dotenv.config();
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { Logger } from '@nestjs/common';
import { ADMIN_PACKAGE_NAME } from 'proto/admin.pb';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: ADMIN_PACKAGE_NAME,
      protoPath: join(process.cwd(), 'proto/admin.proto'), 
      url: process.env.ADMIN_URL, 
      loader: {
        keepCase: true,
        objects: true,
        arrays: true,
      },
    },
  });

  await app.startAllMicroservices();
  console.log(`✅ gRPC server running on ${process.env.ADMIN_URL}`);

  await app.listen(Number(process.env.PORT));
  console.log(`✅ HTTP server running on ${process.env.PORT}`);
}

bootstrap();
