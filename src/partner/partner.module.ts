import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Partner } from './partner.entity';
import { PartnerService } from './partner.service';
import { PayModule } from 'src/pay/pay.module';

@Module({
  imports: [TypeOrmModule.forFeature([Partner]), PayModule], 
  providers: [PartnerService],                  
  controllers: [],            
  exports: [PartnerService],
})
export class PartnerModule {}
