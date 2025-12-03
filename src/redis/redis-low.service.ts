import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisAccountService {
  private redis: Redis;
  private luaSha: string;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || '');
    this.loadLuaScript();
  }

  private async loadLuaScript() {
    const lua = `
      local accountJson = redis.call('GET', KEYS[1])
      local buyerId = tonumber(ARGV[1])

      if not accountJson then
          return -2 -- account chưa khởi tạo
      end

      local accountTable = cjson.decode(accountJson)
      if accountTable.status ~= 'ACTIVE' then
          return -1 -- account đã bán
      end

      -- mark account sold temporarily
      accountTable.status = 'SOLD'
      accountTable.buyerId = buyerId
      redis.call('SET', KEYS[1], cjson.encode(accountTable))

      return 1
    `;
    this.luaSha = await this.redis.script('LOAD', lua) as string;
  }

  /** Reserve account atomic */
  async reserveAccount(accountId: number, buyerId: number): Promise<boolean> {
    const result = await this.redis.evalsha(
      this.luaSha,
      1,
      `hdgstudio::hdgstudio:account:${accountId}`,
      buyerId,
    );
    return result === 1;
  }

  /** Rollback reservation (nếu saga fail) */
  async rollbackAccount(accountId: number): Promise<void> {
    const key = `account:${accountId}`;
    const accountJson = await this.redis.get(key);
    if (!accountJson) return;

    const account = JSON.parse(accountJson);
    if (account.status === 'SOLD') {
      account.status = 'ACTIVE';
      account.buyerId = null;
      await this.redis.set(key, JSON.stringify(account));
    }
  }

//   /** Mark account as sold hoàn toàn (sau saga commit) */
//   async markSold(accountId: number): Promise<void> {
//     // Trong trường hợp chỉ có 2 trạng thái, reserve đã set SOLD, không cần làm gì thêm
//     // Nhưng có thể dùng để đồng bộ DB -> Redis
//     const key = `hdgstudio::hdgstudio:account:${accountId}`;
//     const accountJson = await this.redis.get(key);
//     if (!accountJson) return;

//     const account = JSON.parse(accountJson);
//     account.status = 'SOLD';
//     await this.redis.set(key, JSON.stringify(account));
//   }
}
