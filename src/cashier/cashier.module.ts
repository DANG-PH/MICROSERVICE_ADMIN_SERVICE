import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cashier } from './cashier.entity';
import { CashierService } from './cashier.service';
import { FinanceModule } from 'src/finance/finance.module';
import { PayModule } from 'src/pay/pay.module';

@Module({
  imports: [TypeOrmModule.forFeature([Cashier]), FinanceModule, PayModule], 
  providers: [CashierService],                  
  controllers: [],            
  exports: [CashierService],
})
export class CashierModule {}
