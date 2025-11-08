import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cashier } from './cashier.entity';
import { CashierService } from './cashier.service';

@Module({
  imports: [TypeOrmModule.forFeature([Cashier])], 
  providers: [CashierService],                  
  controllers: [],            
  exports: [CashierService],
})
export class CashierModule {}
