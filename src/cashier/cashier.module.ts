import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cashier } from './cashier.entity';
import { CashierService } from './cashier.service';
import { FinanceModule } from 'src/finance/finance.module';

@Module({
  imports: [TypeOrmModule.forFeature([Cashier]), FinanceModule], 
  providers: [CashierService],                  
  controllers: [],            
  exports: [CashierService],
})
export class CashierModule {}
