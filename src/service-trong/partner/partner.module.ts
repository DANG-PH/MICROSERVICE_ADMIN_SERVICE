import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Partner } from './partner.entity';
import { PartnerService } from './partner.service';
import { PayModule } from 'src/service-ngoai/pay/pay.module';
import { AuthModule } from 'src/service-ngoai/auth/auth.module';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { OutboxEvent } from './outbox-event.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Partner, OutboxEvent]), 
    // Đăng kí client RabbitMQ
    ClientsModule.register([
      {
        name: String(process.env.RABBIT_SERVICE),
        transport: Transport.RMQ,
        options: {
          urls: [String(process.env.RABBIT_URL)],
          queue: process.env.RABBIT_QUEUE,
          queueOptions: { durable: true },
        },
      },
    ]),
    PayModule, 
    AuthModule
  ], 
  providers: [PartnerService],                  
  controllers: [],            
  exports: [PartnerService],
})
export class PartnerModule {}
