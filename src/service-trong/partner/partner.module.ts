import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Partner } from './partner.entity';
import { PartnerService } from './partner.service';
import { PayModule } from 'src/service-ngoai/pay/pay.module';
import { AuthModule } from 'src/service-ngoai/auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Partner]), PayModule, AuthModule], 
  providers: [PartnerService],                  
  controllers: [],            
  exports: [PartnerService],
})
export class PartnerModule {}
