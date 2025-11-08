import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Partner } from './partner.entity';
import { PartnerService } from './partner.service';

@Module({
  imports: [TypeOrmModule.forFeature([Partner])], 
  providers: [PartnerService],                  
  controllers: [],            
  exports: [PartnerService],
})
export class PartnerModule {}
