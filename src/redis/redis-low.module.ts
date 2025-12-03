import { Module, Global } from '@nestjs/common';
import { RedisAccountService } from './redis-low.service';

@Global()
@Module({
  providers: [RedisAccountService],
  exports: [RedisAccountService],
})
export class RedisLowModule {}
