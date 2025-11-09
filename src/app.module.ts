import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { FinanceModule } from 'src/finance/finance.module';
import { CashierModule } from 'src/cashier/cashier.module';
import { EditorModule } from 'src/editor/editor.module';
import { PartnerModule } from 'src/partner/partner.module';
import { AdminModule } from './admin/admin.module';
import { PayModule } from './pay/pay.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,           
      envFilePath: '.env',     
    }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3307,
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true, 
    }),
    AdminModule,
    FinanceModule,
    CashierModule,
    EditorModule,
    PartnerModule,
    PayModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
