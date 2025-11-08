import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Finance } from './finance.entity';
import { FinanceService } from './finance.service';
@Module({
  imports: [TypeOrmModule.forFeature([Finance])], 
  providers: [FinanceService],                  
  controllers: [],            
  exports: [FinanceService],
})
export class FinanceModule {}
