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
} from '../../proto/admin.pb';
import { status } from '@grpc/grpc-js';

@Injectable()
export class PartnerService {
  constructor(
    @InjectRepository(Partner)
    private readonly partnerRepository: Repository<Partner>,
  ) {}

  // ====== Tạo account sell ======
  async createAccountSell(payload: CreateAccountSellRequest): Promise<AccountSellResponse> {
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
}
