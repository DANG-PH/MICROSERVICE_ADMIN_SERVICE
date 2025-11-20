import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashierModule } from 'src/service-trong/cashier/cashier.module';
import { EditorModule } from 'src/service-trong/editor/editor.module';
import { PartnerModule } from 'src/service-trong/partner/partner.module';
import { AdminController } from './admin.controller';
import { PayModule } from 'src/service-ngoai/pay/pay.module';

@Module({
  imports: [CashierModule, EditorModule, PartnerModule, PayModule], // Kết nối entity User
  providers: [],                  // Service sẽ được inject
  controllers: [AdminController],            // Controller xử lý API
  exports: [],
})
export class AdminModule {}
