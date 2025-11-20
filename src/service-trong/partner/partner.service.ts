import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Partner } from './partner.entity';
import { RpcException } from '@nestjs/microservices';
import {
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
  GetAllAccountByBuyerResponse
} from '../../../proto/admin.pb';
import { status } from '@grpc/grpc-js';
import { PayService } from 'src/service-ngoai/pay/pay.service';
import { AuthService } from 'src/service-ngoai/auth/auth.service';

@Injectable()
export class PartnerService {
  constructor(
    @InjectRepository(Partner)
    private readonly partnerRepository: Repository<Partner>,
    private readonly payService: PayService,
    private readonly authService: AuthService
  ) {}

  // ====== Tạo account sell ======
  async createAccountSell(payload: CreateAccountSellRequest): Promise<AccountSellResponse> {
    if (payload.partner_username === payload.username) {
      throw new RpcException({ status: status.CANCELLED, message: "Không thể tự bán acc của chính mình" });
    }

    const account = await this.partnerRepository.findOne({ where: { username: payload.username } });
    if (account && account.status == "ACTIVE") throw new RpcException({ status: status.ALREADY_EXISTS, message: 'Account đã tồn tại' });

    try {
      const accountBan = await this.authService.handleCheckAccount({
        username: payload.username,
        password: payload.password
      })
    } catch (err) {
      // gRPC error từ service B
      // err thường có dạng { code, details, metadata }
      if (err.code && err.details) {
        throw new RpcException({ status: err.code, message: err.details });
      }
      throw err; // fallback
    }

    const newAccount = this.partnerRepository.create({
      username: payload.username,
      password: payload.password,
      url: payload.url,
      description: payload.description,
      price: payload.price,
      status: 'ACTIVE',
      partner_id: payload.partner_id,
      createdAt: new Date(),
    });

    const saved = await this.partnerRepository.save(newAccount);
    return {
      account: {
        ...saved,
        createdAt: saved.createdAt.toISOString(),
      },
    };
  }

  // ====== Cập nhật account ======
  async updateAccountSell(payload: UpdateAccountSellRequest): Promise<AccountSellResponse> {
    const account = await this.partnerRepository.findOne({ where: { id: payload.id } });
    if (!account) throw new RpcException({ status: status.NOT_FOUND, message: 'Không tìm thấy account' });

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
    if (!account) throw new RpcException({ status: status.NOT_FOUND, message: 'Không tìm thấy account' });

    await this.partnerRepository.remove(account);
    return {
      account: {
        ...account,
        createdAt: account.createdAt.toISOString(),
      },
    };
  }

  // ====== Lấy tất cả account active ======
  async getAllActiveAccounts(): Promise<ListAccountSellResponse> {
    const accounts = await this.partnerRepository.find({ where: { status: 'ACTIVE' } });
    const mapped = accounts.map(acc => ({
      ...acc,
      createdAt: acc.createdAt.toISOString(),
    }));
    return { accounts: mapped };
  }

  // ====== Lấy account theo partner ======
  async getAccountsByPartner(payload: GetAccountsByPartnerRequest): Promise<ListAccountSellResponse> {
    const accounts = await this.partnerRepository.find({ where: { partner_id: payload.partner_id } });
    const mapped = accounts.map(acc => ({
      ...acc,
      createdAt: acc.createdAt.toISOString(),
    }));
    return { accounts: mapped };
  }

  // ====== Lấy chi tiết account ======
  async getAccountById(payload: GetAccountByIdRequest): Promise<AccountSellResponse> {
    const account = await this.partnerRepository.findOne({ where: { id: payload.id } });
    if (!account) throw new RpcException({ status: status.NOT_FOUND, message: 'Không tìm thấy account' });

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
    if (!account) throw new RpcException({ status: status.NOT_FOUND, message: 'Không tìm thấy account' });

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
      if (!account) throw new RpcException({ status: status.NOT_FOUND, message: 'Không tìm thấy account' });

      if (account.status === 'SOLD') {
        throw new RpcException({
          status: status.FAILED_PRECONDITION,
          message: 'Tài khoản đã được bán'
        });
      }

      const payResp = await this.payService.getPay({userId: payload.user_id});
      const userBalance = Number(payResp.pay?.tien) || 0;

      if (account.price > userBalance) {
        throw new RpcException({ status: status.FAILED_PRECONDITION, message: 'Số dư không đủ để mua tài khoản này' });
      }

      const emailBuyer = await this.authService.handleGetEmail({id: payload.user_id});
      const newPassword = generateStrongPassword();

      const sessionId = Buffer.from(account.username).toString('base64');

      await this.authService.handleChangePassword({
        sessionId: sessionId,
        oldPassword: account.password,
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
