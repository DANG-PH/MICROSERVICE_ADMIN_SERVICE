import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cashier } from './cashier.entity';
import { CashierService } from './cashier.service';
import { PayModule } from 'src/service-ngoai/pay/pay.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cashier]), 
    PayModule
  ], 
  providers: [CashierService],                  
  controllers: [],            
  exports: [CashierService],
})
export class CashierModule {}
