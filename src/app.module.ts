import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { CashierModule } from 'src/service-trong/cashier/cashier.module';
import { EditorModule } from 'src/service-trong/editor/editor.module';
import { PartnerModule } from 'src/service-trong/partner/partner.module';
import { AdminModule } from './service-trong/admin/admin.module';
import { PayModule } from './service-ngoai/pay/pay.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './service-ngoai/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,           
      envFilePath: '.env',     
    }),
    // TypeOrmModule.forRoot({
    //   type: 'mysql',
    //   host: process.env.DB_HOST,
    //   port: Number(process.env.DB_PORT),
    //   username: process.env.DB_USER,
    //   password: process.env.DB_PASS,
    //   database: process.env.DB_NAME,
    //   entities: [__dirname + '/**/*.entity{.ts,.js}'],
    //   synchronize: true, 
    // }),
    TypeOrmModule.forRoot({
      type: 'postgres',                         
      host: process.env.DB_HOST_POSTGRE,
      port: Number(process.env.DB_PORT_POSTGRE),        
      username: process.env.DB_USER_POSTGRE,
      password: process.env.DB_PASS_POSTGRE,
      database: process.env.DB_NAME_POSTGRE,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true,                        
      // logging: true,                            // optional: bật log query
    }),
    AdminModule,
    CashierModule,
    EditorModule,
    PartnerModule,
    PayModule,
    RedisModule,
    AuthModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
