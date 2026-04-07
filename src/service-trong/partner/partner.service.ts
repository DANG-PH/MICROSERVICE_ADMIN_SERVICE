import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { Partner } from './partner.entity';
import { ClientProxy, RpcException } from '@nestjs/microservices';
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
  ConfirmAccountSellResponse
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
    private readonly payService: PayService,
    private readonly authService: AuthService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly redisAccountService: RedisAccountService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    @Inject(String(process.env.RABBIT_SERVICE)) private readonly emailClient: ClientProxy,
  ) {}

  // ====== Tạo account sell ======
  async createAccountSell(payload: CreateAccountSellRequest): Promise<CreateAccountSellResponse> {
    if (payload.partner_username === payload.username) {
      throw new RpcException({ code: status.CANCELLED, message: "Không thể tự bán acc của chính mình" });
    }

    const account = await this.partnerRepository.findOne({ where: { username: payload.username } });
    if (account && account.status == "ACTIVE") throw new RpcException({ code: status.ALREADY_EXISTS, message: 'Account đã tồn tại' });

    const accountBan = await this.authService.handleCheckAccount({
      username: payload.username,
      password: payload.password
    })

    if (!accountBan.sessionId) throw new RpcException({ code: status.ALREADY_EXISTS, message: 'Account không khả dụng' });

    const token = randomUUID(); 

    // lưu tạm vào Redis
    await this.redis.set(
      `ACCOUNT:SELL:${token}`,
      JSON.stringify({
        username: payload.username,
        url: payload.url,
        description: payload.description,
        price: payload.price,
        partner_id: payload.partner_id,
      }),
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

    const CONFIRM_SCRIPT = `
      local key = KEYS[1]

      local val = redis.call("GET", key)
      if not val then
        return nil
      end

      redis.call("DEL", key)
      return val
    `;

    const redisKey = `ACCOUNT:SELL:${payload.token}`;

    // 1. Atomic get + del bằng Lua
    const raw = await this.redis.eval(
      CONFIRM_SCRIPT,
      1,
      redisKey
    ) as string | null;

    if (!raw) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'Token không hợp lệ hoặc đã hết hạn',
      });
    }

    const data = JSON.parse(raw);

    const newAccount = this.partnerRepository.create({
      ...data,
      status: 'ACTIVE',
      createdAt: new Date(),
    });

    await this.partnerRepository.save(newAccount);

    return {
      success: true
    };
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

  async buyAccount(payload: BuyAccountRequest): Promise<AccountInformationResponse> {
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

      // tạm thời chưa transaction tiền ( sau này có thể bổ sung thêm transaction cho payservice )
      //Trừ tiền người mua nick
      await this.payService.updateMoney({userId: payload.user_id, amount: 0-account.price})
      //Trừ tiền cộng tiền cho partner bán nick
      await this.payService.updateMoney({userId: account.partner_id, amount: account.price*0.98})

      account.status = 'SOLD';
      account.buyer_id = payload.user_id;
      account.password = newPassword;
      await manager.save(account);

      return {
        username: account.username,
        password: account.password
      };
      //Nếu 1 trong mấy service đó thất bại -> hệ thống mất đồng bộ.
      // chỗ này cần transaction kỹ nếu có time
    });
  }

  // Orchestration Saga ( bổ sung cho cách buyaccount ở trên) ( Còn 1 cách nữa là Choreography Saga có thể bổ sung sau)
  async buyAccountSaga(payload: BuyAccountRequest): Promise<AccountInformationResponse> {
    // Cách Permisstic Lock

    // Step 1: lock DB row
    // const account = await this.partnerRepository.manager.transaction(async (manager) => {
    //   const acc = await manager.findOne(Partner, {
    //     where: { id: payload.id },
    //     lock: { mode: 'pessimistic_write' },
    //   });

    //   if (!acc) throw new RpcException({ code: status.NOT_FOUND, message: 'Không tìm thấy account' });
    //   if (acc.username === payload.username)
    //     throw new RpcException({ code: status.FAILED_PRECONDITION, message: 'Không thể tự mua acc chính mình' });
    //   if (acc.status === 'SOLD')
    //     throw new RpcException({ code: status.FAILED_PRECONDITION, message: 'Tài khoản đã được bán' });

    //   return acc;
    // });

    // Cách Redis + Lua Script
    // Step 1: reserve account atomically
    const reserved = await this.redisAccountService.reserveAccount(payload.id, payload.user_id);
    if (!reserved) {
      throw new RpcException({ code: status.FAILED_PRECONDITION, message: 'Account đã được bán hoặc đang xử lý' });
    }

    const account = await this.partnerRepository.findOne({ where: { id: payload.id } });
    if (!account) throw new RpcException({ code: status.NOT_FOUND, message: 'Không tìm thấy account' });
    if (account.username === payload.username)
      throw new RpcException({ code: status.FAILED_PRECONDITION, message: 'Không thể tự mua acc chính mình' });


    // Step 2: check user balance
    const payResp = await this.payService.getPay({ userId: payload.user_id });

    const userBalance = Number(payResp.pay?.tien) || 0;
    if (account.price > userBalance)
      throw new RpcException({ code: status.FAILED_PRECONDITION, message: 'Số dư không đủ để mua tài khoản này' });

    const emailBuyer = await this.authService.handleGetEmail({ id: payload.user_id });
    const emailNguoiBan = await this.authService.handleGetEmail({ id: account.partner_id });
    const newPassword = generateStrongPassword();
    const sessionId = Buffer.from(account.username).toString('base64');

    // Step 3: Saga orchestration with compensating actions
    let buyerPaid = false;
    let sellerPaid = false;
    let passwordChanged = false;
    let emailChanged = false;

    await this.cacheManager.set(
      `saga:buyAccount:${payload.user_id}:${payload.id}`,
      JSON.stringify({
        buyerPaid: false,
        sellerPaid: false,
        passwordChanged: false,
        emailChanged: false
      })
    );  // nếu crash server thì vẫn xử lí đc


    try {
      // Trừ tiền người mua
      await this.payService.updateMoney({ userId: payload.user_id, amount: -account.price });
      buyerPaid = true;
      await this.cacheManager.set(
        `saga:buyAccount:${payload.user_id}:${payload.id}`,
        JSON.stringify({
          buyerPaid: buyerPaid,
          sellerPaid: sellerPaid,
          passwordChanged: passwordChanged,
          emailChanged: emailChanged
        })
      ); 

      // Cộng tiền cho seller
      await this.payService.updateMoney({ userId: account.partner_id, amount: account.price * 0.98 });
      sellerPaid = true;
      await this.cacheManager.set(
        `saga:buyAccount:${payload.user_id}:${payload.id}`,
        JSON.stringify({
          buyerPaid: buyerPaid,
          sellerPaid: sellerPaid,
          passwordChanged: passwordChanged,
          emailChanged: emailChanged
        })
      ); 

      // Change password
      await this.authService.handleChangePassword({
        sessionId,
        oldPassword: account.password,
        newPassword,
      });
      passwordChanged = true;
      await this.cacheManager.set(
        `saga:buyAccount:${payload.user_id}:${payload.id}`,
        JSON.stringify({
          buyerPaid: buyerPaid,
          sellerPaid: sellerPaid,
          passwordChanged: passwordChanged,
          emailChanged: emailChanged
        })
      ); 

      // Change email
      await this.authService.handleChangeEmail({
        sessionId,
        newEmail: emailBuyer.email,
      });
      emailChanged = true;
      await this.cacheManager.set(
        `saga:buyAccount:${payload.user_id}:${payload.id}`,
        JSON.stringify({
          buyerPaid: buyerPaid,
          sellerPaid: sellerPaid,
          passwordChanged: passwordChanged,
          emailChanged: emailChanged
        })
      ); 

      // Step 4: update DB
      await this.partnerRepository.manager.transaction(async (manager) => {
        account.status = 'SOLD';
        account.buyer_id = payload.user_id;
        account.password = newPassword;
        await manager.save(account);
      });

      await this.cacheManager.del(`saga:buyAccount:${payload.user_id}:${payload.id}`);

      return { username: account.username, password: newPassword };
    } catch (err) {
      // Step 5: compensating actions
      if (emailChanged) {
        await this.authService.handleChangeEmail({
          sessionId,
          newEmail: emailNguoiBan.email, // rollback về email cũ
        }).catch(() => {});
      }

      if (passwordChanged) {
        await this.authService.handleChangePassword({
          sessionId,
          oldPassword: newPassword,
          newPassword: account.password, // rollback password cũ
        }).catch(() => {});
      }

      if (sellerPaid) {
        await this.payService.updateMoney({ userId: account.partner_id, amount: -account.price * 0.98 }).catch(() => {});
      }

      if (buyerPaid) {
        await this.payService.updateMoney({ userId: payload.user_id, amount: account.price }).catch(() => {});
      }

      await this.redisAccountService.rollbackAccount(payload.id); // rollback redis + lua

      throw new RpcException({code: status.INTERNAL, message: err}); // rethrow để caller biết
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

  async recoverSaga() {
    const keys = await this.redis.keys('hdgstudio::hdgstudio:saga:buyAccount:*');
    console.log(keys)
    for (const key of keys) {
      console.log(key)
      const saga = JSON.parse(await this.redis.get(key) || '{}');
      const [, userId, accountId] = key.split(':').slice(-3);
      const sessionId = Buffer.from(accountId).toString('base64');
      const account = await this.partnerRepository.findOne({ where: { id: Number(accountId) } });
      if (!account) continue;
      const sellerEmail = await this.authService.handleGetEmail({ id: Number(account.partner_id) });

      if (saga.emailChanged) await this.authService.handleChangeEmail({ sessionId, newEmail: sellerEmail.email }).catch(() => {});
      // if (saga.passwordChanged) await this.authService.handleChangePassword({ sessionId, oldPassword: generateStrongPassword(), newPassword: account.password }).catch(() => {}); // sai logic 1 chut nhung co email thi ko sao
      if (saga.sellerPaid) await this.payService.updateMoney({ userId: account.partner_id, amount: -account.price * 0.98 }).catch(() => {});
      if (saga.buyerPaid) await this.payService.updateMoney({ userId: Number(userId), amount: account.price }).catch(() => {});

      await this.redis.del(key);
    }
  }

  async onModuleInit() {
    try {
      await this.recoverSaga();
    } catch (err) {
      console.error('Error recovering saga:', err);
    }
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
