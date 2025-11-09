import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceModule } from 'src/finance/finance.module';
import { CashierModule } from 'src/cashier/cashier.module';
import { EditorModule } from 'src/editor/editor.module';
import { PartnerModule } from 'src/partner/partner.module';
import { AdminController } from './admin.controller';
import { PayModule } from 'src/pay/pay.module';

@Module({
  imports: [FinanceModule ,CashierModule, EditorModule, PartnerModule, PayModule], // Kết nối entity User
  providers: [],                  // Service sẽ được inject
  controllers: [AdminController],            // Controller xử lý API
  exports: [],
})
export class AdminModule {}
