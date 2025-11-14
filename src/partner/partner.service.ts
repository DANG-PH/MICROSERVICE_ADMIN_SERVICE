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
} from '../../proto/admin.pb';
import { status } from '@grpc/grpc-js';
import { PayService } from 'src/pay/pay.service';

@Injectable()
export class PartnerService {
  constructor(
    @InjectRepository(Partner)
    private readonly partnerRepository: Repository<Partner>,
    private readonly payService: PayService,
  ) {}

  // ====== Tạo account sell ======
  async createAccountSell(payload: CreateAccountSellRequest): Promise<AccountSellResponse> {
    const account = await this.partnerRepository.findOne({ where: { username: payload.username } });
    if (account) throw new RpcException({ status: status.ALREADY_EXISTS, message: 'Account đã tồn tại' });

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

      // tạm thời chưa transaction tiền ( sau này có thể bổ sung thêm transaction cho payservice )

      //Trừ tiền người mua nick
      await this.payService.updateMoney({userId: payload.user_id, amount: 0-account.price})
      //Trừ tiền cộng tiền cho partner bán nick
      await this.payService.updateMoney({userId: account.partner_id, amount: account.price*0.98})

      account.status = 'SOLD';
      account.buyer_id = payload.user_id;
      await manager.save(account);

      return {
        username: account.username,
        password: account.password
      };
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
