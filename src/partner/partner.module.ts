import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Partner } from './partner.entity';
import { PartnerService } from './partner.service';
import { PayModule } from 'src/pay/pay.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Partner]), PayModule, AuthModule], 
  providers: [PartnerService],                  
  controllers: [],            
  exports: [PartnerService],
})
export class PartnerModule {}
