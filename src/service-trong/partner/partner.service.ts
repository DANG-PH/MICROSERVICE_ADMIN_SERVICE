import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, OptimisticLockVersionMismatchError, Repository } from 'typeorm';
import { Partner } from './partner.entity';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { LessThanOrEqual } from 'typeorm';
import type {
  CreateAccountSellRequest,
  UpdateAccountSellRequest,
  DeleteAccountSellRequest,
  GetAccountsByPartnerRequest,
  GetAccountByIdRequest,
  UpdateAccountStatusRequest,
  AccountSellResponse,
  ListAccountSellResponse,
  AccountInformationResponse,
  BuyAccountRequest,
  GetAllAccountByBuyerRequest,
  GetAllAccountByBuyerResponse,
  ListAccountSellRequest,
  CreateAccountSellResponse,
  ConfirmAccountSellRequest,
  ConfirmAccountSellResponse,
  BuyAccountResponse
} from '../../../proto/admin.pb';
import { status } from '@grpc/grpc-js';
import { PayService } from 'src/service-ngoai/pay/pay.service';
import { AuthService } from 'src/service-ngoai/auth/auth.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from '@nestjs/cache-manager';
import { RedisAccountService } from 'src/redis/redis-low.service';
import Redis from 'ioredis';
import { GrpcErrorHandler } from 'src/decorators/grpc-error-handler.decorator';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { OutboxEvent } from './outbox-event.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

// @GrpcErrorHandler() chạy TRƯỚC @Injectable()
// Thứ tự decorator trong TypeScript: chạy từ dưới lên trên
// 1. @Injectable() chạy trước → NestJS đánh dấu class để inject dependency
// 2. @GrpcErrorHandler() chạy sau → wrap tất cả methods
@GrpcErrorHandler()
@Injectable()
export class PartnerService {
  constructor(
    @InjectRepository(Partner)
    private readonly partnerRepository: Repository<Partner>,
    @InjectRepository(OutboxEvent)
    private readonly outboxRepository: Repository<OutboxEvent>,
    private readonly payService: PayService,
    private readonly authService: AuthService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly redisAccountService: RedisAccountService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    @Inject(String(process.env.RABBIT_SERVICE)) private readonly queueClient: ClientProxy,
    private eventEmitter: EventEmitter2
  ) {}

  // ====== Tạo account sell ======
  async createAccountSell(payload: CreateAccountSellRequest): Promise<CreateAccountSellResponse> {
    if (payload.partner_username === payload.username) {
      throw new RpcException({ code: status.CANCELLED, message: "Không thể tự bán acc của chính mình" });
    }

    const account = await this.partnerRepository.findOne({ where: { username: payload.username } });
    if (account && account.status == "ACTIVE") throw new RpcException({ code: status.ALREADY_EXISTS, message: 'Account đã tồn tại' });

    const pendingKey = `ACCOUNT:SELL:PENDING:${payload.username}`;
    const existing = await this.redis.get(pendingKey);
    if (existing) {
      throw new RpcException({ code: status.ALREADY_EXISTS, message: 'Yêu cầu bán đã gửi, check email' });
    }

    const accountBan = await this.authService.handleCheckAccount({
      username: payload.username,
      password: payload.password
    })

    if (!accountBan.sessionId) throw new RpcException({ code: status.ALREADY_EXISTS, message: 'Account không khả dụng' });

    const token = randomUUID(); 

    // lưu tạm vào Redis
    await this.redis.set(
      pendingKey,
      JSON.stringify({
        token, // lưu token vào value để dùng lúc confirm
        username: payload.username,
        password: payload.password,
        url: payload.url,
        description: payload.description,
        price: payload.price,
        partner_id: payload.partner_id,
      }),
      'EX',
      600,
      'NX'
    );

    // Key confirm tra cứu ngược từ token → data
    await this.redis.set(
      `ACCOUNT:SELL:TOKEN:${token}`,
      payload.username,
      'EX',
      600
    );

    // gửi email confirm
    const confirmLink = `${process.env.DOMAIN_BACKEND}/partner/confirm-sell?token=${token}`;

    await this.authService.handleSendEmailToUser({
      who: payload.username,
      title: "Xác nhận đăng bán tài khoản",
      content: `
        Chúng tôi nhận được yêu cầu đăng bán tài khoản của bạn trên hệ thống.
        <br><br>
        Để hoàn tất quá trình này, vui lòng xác nhận bằng cách nhấn vào liên kết bên dưới:
        <br><br>
        👉 <b>
          <a href="${confirmLink}" target="_blank" rel="noopener noreferrer">
            Xác nhận đăng bán tài khoản
          </a>
        </b>
        <br><br>
        Liên kết này sẽ hết hạn sau 10 phút.
        <br><br>
        Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này để đảm bảo an toàn cho tài khoản của bạn.
      `
    })

    return {
      success: true,
    };
  }

  async confirmAccountSell(
    payload: ConfirmAccountSellRequest
  ): Promise<ConfirmAccountSellResponse> {

    const TOKEN_KEY = `ACCOUNT:SELL:TOKEN:${payload.token}`;

    // Step 1: Lấy username từ token key (atomic get + del)
    const GET_DEL_SCRIPT = `
      local val = redis.call("GET", KEYS[1])
      if not val then
        return nil
      end
      redis.call("DEL", KEYS[1])
      return val
    `;

    const username = await this.redis.eval(
      GET_DEL_SCRIPT,
      1,
      TOKEN_KEY
    ) as string | null;

    if (!username) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'Token không hợp lệ hoặc đã hết hạn',
      });
    }

    // Step 2: Lấy data + xóa pending key (atomic)
    const PENDING_KEY = `ACCOUNT:SELL:PENDING:${username}`;

    const raw = await this.redis.eval(
      GET_DEL_SCRIPT,
      1,
      PENDING_KEY
    ) as string | null;

    if (!raw) {
      // Token đã dùng nhưng pending key mất → idempotent, không crash
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'Yêu cầu không còn tồn tại',
      });
    }

    const data = JSON.parse(raw);

    // Step 3: Double-check account chưa tồn tại (race condition giữa 2 confirm đồng thời)
    const existing = await this.partnerRepository.findOne({
      where: { username: data.username }
    });

    if (existing?.status === 'ACTIVE') {
      throw new RpcException({
        code: status.ALREADY_EXISTS,
        message: 'Account đã được xác nhận trước đó',
      });
    }

    // Step 4: Lưu DB
    const newAccount = this.partnerRepository.create({
      username: data.username,
      password: data.password,
      url: data.url,
      description: data.description,
      price: data.price,
      partner_id: data.partner_id,
      status: 'ACTIVE',
      createdAt: new Date(),
    });

    await this.partnerRepository.save(newAccount);

    return { success: true };
  }

  // ====== Cập nhật account ======
  async updateAccountSell(payload: UpdateAccountSellRequest): Promise<AccountSellResponse> {
    const account = await this.partnerRepository.findOne({ where: { id: payload.id } });
    if (!account) throw new RpcException({ code: status.NOT_FOUND, message: 'Không tìm thấy account' });

    account.url = payload.url;
    account.description = payload.description;
    account.price = payload.price;

    const updated = await this.partnerRepository.save(account);
    return {
      account: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
      },
    };
  }

  // ====== Xoá account ======
  async deleteAccountSell(payload: DeleteAccountSellRequest): Promise<AccountSellResponse> {
    const account = await this.partnerRepository.findOne({ where: { id: payload.id } });
    if (!account) throw new RpcException({ code: status.NOT_FOUND, message: 'Không tìm thấy account' });

    await this.partnerRepository.remove(account);

    return {
      account: {
        ...account,
        createdAt: account.createdAt.toISOString(),
      },
    };
  }

  // ====== Lấy tất cả account active ======
  async getAllActiveAccounts(payload: ListAccountSellRequest): Promise<ListAccountSellResponse> {
    const page = Number(payload.paginationRequest?.page) || 1;
    const itemPerPage = Number(payload.paginationRequest?.itemPerPage) || 10;
    const search = payload.paginationRequest?.search || "";

    const skip = (page - 1)*itemPerPage;

    const [accounts, total] = await this.partnerRepository.findAndCount({ 
      where: {
        status: 'ACTIVE',
        description: Like('%' + search + '%')
      }, 
      order: { createdAt: "DESC"},
      take: itemPerPage,
      skip: skip,
    });

    const lastPage = Math.ceil(total/itemPerPage);
    const nextPage = page + 1 <= lastPage ? page + 1 : -1;
    const prevPage = page - 1 >= 1 ? page - 1 : -1;

    const mapped = accounts.map(acc => ({
      ...acc,
      createdAt: acc.createdAt.toISOString(),
    }));
    return { 
      accounts: mapped,
      paginationResponse: {
        total: total,
        currentPage: page,
        lastPage: lastPage,
        nextPage: nextPage,
        prevPage: prevPage,
      } 
    };
  }

  // ====== Lấy account theo partner ======
  async getAccountsByPartner(payload: GetAccountsByPartnerRequest): Promise<ListAccountSellResponse> {

    const page = Number(payload.paginationRequest?.page) || 1;
    const itemPerPage = Number(payload.paginationRequest?.itemPerPage) || 10;
    const search = payload.paginationRequest?.search || "";

    const skip = (page - 1)*itemPerPage;

    const [accounts, total] = await this.partnerRepository.findAndCount({
      where: { 
        partner_id: payload.partner_id,
        description: Like('%' + search + '%') 
      },
      order: { createdAt: "DESC"},
      take: itemPerPage,
      skip: skip, 
    });
    const mapped = accounts.map(acc => ({
      ...acc,
      createdAt: acc.createdAt.toISOString(),
    }));

    const lastPage = Math.ceil(total/itemPerPage);
    const nextPage = page + 1 <= lastPage ? page + 1 : -1;
    const prevPage = page - 1 >= 1 ? page - 1 : -1;

    return { 
      accounts: mapped,
      paginationResponse: {
        total: total,
        currentPage: page,
        lastPage: lastPage,
        nextPage: nextPage,
        prevPage: prevPage,
      }  
    };
  }

  // ====== Lấy chi tiết account ======
  async getAccountById(payload: GetAccountByIdRequest): Promise<AccountSellResponse> {
    const account = await this.partnerRepository.findOne({ where: { id: payload.id } });
    if (!account) throw new RpcException({ code: status.NOT_FOUND, message: 'Không tìm thấy account' });

    return {
      account: {
        ...account,
        createdAt: account.createdAt.toISOString(),
      },
    };
  }

  // ====== Đánh dấu account đã bán hoặc active ======
  async markAccountAsSold(payload: UpdateAccountStatusRequest): Promise<AccountSellResponse> {
    const account = await this.partnerRepository.findOne({ where: { id: payload.id } });
    if (!account) throw new RpcException({ code: status.NOT_FOUND, message: 'Không tìm thấy account' });

    account.status = payload.status;
    const updated = await this.partnerRepository.save(account);

    return {
      account: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
      },
    };
  }

  async buyAccount(payload: BuyAccountRequest): Promise<BuyAccountResponse> {
    return await this.partnerRepository.manager.transaction(async (manager) => { // transaction roll back
      const account = await manager.findOne(Partner, {
        where: { id: payload.id },
        lock: { mode: 'pessimistic_write' } // khoá row để tránh race condition tránh được 2 người mua cùng lúc.
      });
      if (!account) throw new RpcException({ code: status.NOT_FOUND, message: 'Không tìm thấy account' });

      if (account.username == payload.username) {
          throw new RpcException({
          code: status.FAILED_PRECONDITION,
          message: 'Không thể tự mua acc chính mình'
        });
      }

      if (account.status === 'SOLD') {
        throw new RpcException({
          code: status.FAILED_PRECONDITION,
          message: 'Tài khoản đã được bán'
        });
      }

      const payResp = await this.payService.getPay({userId: payload.user_id});
      const userBalance = Number(payResp.pay?.tien) || 0;

      if (account.price > userBalance) {
        throw new RpcException({ code: status.FAILED_PRECONDITION, message: 'Số dư không đủ để mua tài khoản này' });
      }

      const emailBuyer = await this.authService.handleGetEmail({id: payload.user_id});
      const newPassword = generateStrongPassword();

      const sessionId = Buffer.from(account.username).toString('base64');

      await this.authService.handleSystemChangePassword({
        sessionId: sessionId,
        newPassword: newPassword
      })

      await this.authService.handleChangeEmail({
        sessionId: sessionId,
        newEmail: emailBuyer.email
      })

      //Trừ tiền người mua nick
      await this.payService.updateMoney({userId: payload.user_id, amount: 0-account.price})
      //Trừ tiền cộng tiền cho partner bán nick
      await this.payService.updateMoney({userId: account.partner_id, amount: account.price*0.98})

      // Tăng tokenVersion (Tránh user cũ vẫn vào được tài khoản)
      await this.authService.handleSetTokenVersion({username: account.username})

      account.status = 'SOLD';
      account.buyer_id = payload.user_id;
      account.password = newPassword;
      await manager.save(account);

      return {
        message: "Mua tài khoản thành công"
      };
      //Nếu 1 trong mấy service đó thất bại -> hệ thống mất đồng bộ.
      // chỗ này cần transaction kỹ nếu có time
    });
  }

  async buyAccountSaga(payload: BuyAccountRequest): Promise<BuyAccountResponse> {
    // Validate nhanh (không cần transaction)
    const account = await this.partnerRepository.findOne({ where: { id: payload.id } });
    if (!account)
      throw new RpcException({ code: status.NOT_FOUND, message: 'Không tìm thấy account' });
    if (account.username === payload.username)
      throw new RpcException({ code: status.FAILED_PRECONDITION, message: 'Không thể tự mua acc chính mình' });
    if (account.status === 'SOLD')
      throw new RpcException({ code: status.FAILED_PRECONDITION, message: 'Tài khoản đã được bán' });

    // Check số dư trước (network call, ngoài transaction để tránh giữ lock lâu)
    const payResp = await this.payService.getPay({ userId: payload.user_id });
    const userBalance = Number(payResp.pay?.tien) || 0;
    if (account.price > userBalance)
      throw new RpcException({ code: status.FAILED_PRECONDITION, message: 'Số dư không đủ' });

    // Atomic: pessimistic lock + mark PENDING + ghi Outbox — cùng 1 transaction
    await this.partnerRepository.manager.transaction(async (manager) => {
      const locked = await manager.findOne(Partner, {
        where: { id: payload.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!locked || locked.status !== 'ACTIVE')
        throw new RpcException({ code: status.FAILED_PRECONDITION, message: 'Tài khoản không còn khả dụng' });

      locked.status = 'PENDING';
      locked.buyer_id = payload.user_id;
      await manager.save(locked);

      // Outbox ghi cùng transaction — đây là điểm mấu chốt
      // Nếu commit thành công → chắc chắn có outbox row để process
      // Nếu crash sau commit → cron sẽ pick up và retry
      const outbox = manager.create(OutboxEvent, {
        sagaType: 'BUY_ACCOUNT',
        payload: { ...payload, accountPrice: account.price },
        status: 'PENDING',
        retries: 0,
        maxRetries: 3,
        nextRetryAt: new Date(),
      });
      await manager.save(outbox);
    });

    return { message: 'Đơn hàng đang được xử lý' };
  }

  // ─── STEP 2: Cron job — poll outbox và đẩy vào queue ─────────────────────────

  @Cron(CronExpression.EVERY_5_SECONDS) // mỗi 5 giây
  async pollOutbox(): Promise<void> {
    const events = await this.outboxRepository.find({
      where: {
        status: 'PENDING',
        nextRetryAt: LessThanOrEqual(new Date()),
      },
      order: { createdAt: 'ASC' },
      take: 20,
    });

    for (const event of events) {
      // Mark PROCESSING để tránh cron khác pick up cùng lúc
      const result = await this.outboxRepository.update(
        { id: event.id, status: 'PENDING' }, // optimistic check
        { status: 'PROCESSING' },
      );
      if (result.affected === 0) continue;

      try {
        await this.processOutboxEvent(event)
      } catch (error) {
        // Đưa về PENDING để retry lần sau
        await this.outboxRepository.update(event.id, { status: 'PENDING' })
      }
    }
  }

  // Dùng tạm thay queue ( có queue service rồi nhưng cảm giác chưa cần lắm )
  // @OnEvent('saga.buy_account')
  // async handle(event: OutboxEvent): Promise<void> {
  //   await this.processOutboxEvent(event);
  // }

  @Cron('*/30 * * * * *')
  async recoverStuckProcessing(): Promise<void> {
    const stuckThreshold = new Date(Date.now() - 5 * 60_000); // 5 phút
    await this.outboxRepository.update(
      { status: 'PROCESSING', updatedAt: LessThanOrEqual(stuckThreshold) },
      { status: 'PENDING' },
    );
  }

  // ─── STEP 3: Consumer — xử lý saga với idempotency + retry + compensation ────

  async processOutboxEvent(event: OutboxEvent): Promise<void> {
    const lockKey = `saga:lock:${event.id}`;
    const doneKey = `saga:done:${event.id}`;

    // Idempotency: nếu đã xử lý thành công rồi thì skip
    const alreadyDone = await this.redis.get(doneKey);
    if (alreadyDone) {
      await this.outboxRepository.update(event.id, { status: 'DONE' });
      return;
    }

    // Distributed lock: ngăn duplicate processing khi nhiều consumer chạy song song
    const acquired = await this.redis.set(lockKey, '1', 'EX', 300, 'NX');
    if (!acquired) return; // consumer khác đang xử lý

    try {
      await this.executeSagaSteps(event);

      // Thành công: đánh dấu done
      await this.outboxRepository.update(event.id, { status: 'DONE' });
      // Cache idempotency key 24h để tránh re-process nếu cron chạy lại
      await this.redis.set(doneKey, '1', 'EX', 86400);
    } catch (error) {
      await this.handleSagaFailure(event, error);
    } finally {
      await this.redis.del(lockKey);
    }
  }

  // ─── STEP 3a: Thực thi các bước saga (với tracking để compensate đúng) ────────

  private async executeSagaSteps(event: OutboxEvent): Promise<void> {
    const payload = event.payload as BuyAccountRequest & { accountPrice: number };

    // Lấy data cần thiết song song
    const [emailBuyer, originalEmailResp] = await Promise.all([
      this.authService.handleGetEmail({ id: payload.user_id }),
      this.authService.handleGetEmailByUsername({ username: payload.username }),
    ]);

    const account = await this.partnerRepository.findOne({ where: { id: payload.id } });
    if (!account)
      throw new Error(`Account ${payload.id} not found`);

    const newPassword = generateStrongPassword();
    const sessionId = Buffer.from(account.username).toString('base64');
    const originalPassword = account.password;

    // Track từng bước để compensation chính xác
    let changePassDone = false;
    let changeEmailDone = false;
    let deductBuyerDone = false;
    let creditPartnerDone = false;

    try {
      await this.authService.handleSystemChangePassword({ sessionId, newPassword });
      changePassDone = true;

      await this.authService.handleChangeEmail({ sessionId, newEmail: emailBuyer.email });
      changeEmailDone = true;

      await this.payService.updateMoney({ userId: payload.user_id, amount: -payload.accountPrice });
      deductBuyerDone = true;

      await this.payService.updateMoney({ userId: account.partner_id, amount: payload.accountPrice * 0.98 });
      creditPartnerDone = true;

      console.log("KICK USER: "+payload.username)
      await this.authService.handleSetTokenVersion({ username: payload.username });

      // Finalize: PENDING → SOLD
      await this.partnerRepository.update(
        { id: payload.id, status: 'PENDING' },
        { status: 'SOLD', password: newPassword },
      );

      await this.authService.handleSendEmailToUser({
        who: payload.username, // email buyer
        title: 'Mua tài khoản thành công',
        content: `Username: ${account.username} | Password: ${newPassword}`
      });

    } catch (error) {
      // Compensation song song, không throw để giữ nguyên error gốc
      const compensations: Promise<any>[] = [];

      if (creditPartnerDone)
        compensations.push(
          this.payService.updateMoney({ userId: account.partner_id, amount: -(payload.accountPrice * 0.98) })
        );
      if (deductBuyerDone)
        compensations.push(
          this.payService.updateMoney({ userId: payload.user_id, amount: payload.accountPrice })
        );
      if (changeEmailDone)
        compensations.push(
          this.authService.handleChangeEmail({ sessionId, newEmail: originalEmailResp.email })
        );
      if (changePassDone)
        compensations.push(
          this.authService.handleSystemChangePassword({ sessionId, newPassword: originalPassword })
        );

      const results = await Promise.allSettled(compensations);
      results.forEach((result, i) => {
        if (result.status === 'rejected')
          console.error(`CRITICAL: compensation step ${i} failed — account ${payload.id}`, result.reason);
      });

      throw error; // re-throw để handleSagaFailure quyết định retry hay fail
    }
  }

  // ─── STEP 3b: Xử lý failure — retry với exponential backoff hoặc compensate ──

  private async handleSagaFailure(event: OutboxEvent, error: unknown): Promise<void> {
    const payload = event.payload as { id: string };
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (event.retries < event.maxRetries) {
      // Exponential backoff: 30s → 2m → 10m
      const delayMs = Math.pow(4, event.retries + 1) * 30_000;
      const nextRetryAt = new Date(Date.now() + delayMs);

      await this.outboxRepository.update(event.id, {
        status: 'PENDING',
        retries: event.retries + 1,
        nextRetryAt,
        lastError: errorMessage,
      });

      console.warn(
        `Saga ${event.id} retry ${event.retries + 1}/${event.maxRetries} — next at ${nextRetryAt.toISOString()}`
      );
    } else {
      // Hết retry: đưa account về ACTIVE và đánh FAILED
      await this.outboxRepository.update(event.id, {
        status: 'FAILED',
        lastError: errorMessage,
      });

      await this.partnerRepository.update(
        { id: Number(payload.id), status: 'PENDING' },
        { status: 'ACTIVE', buyer_id: null },
      ).catch(e => console.error(`CRITICAL: account ${payload.id} kẹt PENDING sau max retries`, e));

      // TODO: gửi alert (Slack, email, PagerDuty...)
      console.error(`CRITICAL: Saga ${event.id} FAILED after ${event.maxRetries} retries — manual review needed`);
    }
  }

  async getAllAccountByBuyer(payload: GetAllAccountByBuyerRequest): Promise<GetAllAccountByBuyerResponse> {
    const accounts = await this.partnerRepository.find({
      where: { buyer_id: payload.buyer_id, status: 'SOLD' }
    });

    const mapped = accounts.map(acc => ({
      username: acc.username,
      password: acc.password,
    }));

    return { accounts: mapped };
  }
}

function generateStrongPassword(length = 14): string {
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const special = "!@#$%^&*()_+-=[]{};:,.<>?";

  const all = lower + upper + numbers + special;

  // Bắt buộc mỗi loại 1 ký tự
  let password = [
    lower[Math.floor(Math.random() * lower.length)],
    upper[Math.floor(Math.random() * upper.length)],
    numbers[Math.floor(Math.random() * numbers.length)],
    special[Math.floor(Math.random() * special.length)],
  ];

  // Sinh phần còn lại
  for (let i = 0; i < length-4; i++) {
    const randIndex = Math.floor(Math.random() * all.length);
    password.push(all[randIndex]);
  }

  // Trộn ngẫu nhiên
  return password.join('');
}
