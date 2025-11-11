import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cashier } from './cashier.entity';
import { PayService } from 'src/pay/pay.service';
import { RpcException } from '@nestjs/microservices';
import {
  CreateWithdrawRequestt,
  GetWithdrawsByUserRequest,
  UpdateWithdrawStatusRequest,
  WithdrawResponse,
  ListWithdrawResponse,
} from '../../proto/admin.pb';
import { status } from '@grpc/grpc-js';
import { FinanceService } from 'src/finance/finance.service';
import { winstonLogger } from 'src/logger/logger.config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class CashierService {
  constructor(
    @InjectRepository(Cashier)
    private readonly cashierRepository: Repository<Cashier>,
    private readonly payService: PayService,
    private readonly financeService: FinanceService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {}
   // ====== Tạo yêu cầu rút tiền ======
  async createWithdrawRequest(payload: CreateWithdrawRequestt): Promise<WithdrawResponse> {
    // 1. Kiểm tra số dư của người dùng
    const payResp = await this.payService.getPay({userId: payload.user_id});
    const userBalance = Number(payResp.pay?.tien) || 0;

    if (payload.amount > userBalance) {
      throw new RpcException({ status: status.FAILED_PRECONDITION, message: 'Số dư không đủ để rút' });
    }

    // 2. Tạo bản ghi rút tiền
    const newWithdraw = this.cashierRepository.create({
      user_id: payload.user_id,
      amount: payload.amount,
      bank_name: payload.bank_name,
      bank_number: payload.bank_number,
      bank_owner: payload.bank_owner,
      status: 'PENDING',
      request_at: new Date(),
    });

    const saved = await this.cashierRepository.save(newWithdraw);

    const key = `rut_tien:${payload.user_id}:${saved.id}`;;
    await this.cacheManager.set(key, payload.amount);
    await this.payService.updateMoney({userId: payload.user_id, amount: 0-payload.amount})
    return {
      withdraw: {
        ...saved,
        request_at: saved.request_at.toISOString(),
        success_at: saved.success_at ? saved.success_at.toISOString() : '',
      } 
    };
  }

  // ====== Lấy lịch sử rút tiền của user ======
  async getWithdrawsByUser(payload: GetWithdrawsByUserRequest): Promise<ListWithdrawResponse> {
    const withdraws = await this.cashierRepository.find({ where: { user_id: payload.user_id } });
    const mappedWithdraws = withdraws.map(withdraw => ({
      ...withdraw,
      request_at: withdraw.request_at.toISOString(),
      success_at: withdraw.success_at ? withdraw.success_at.toISOString() : '',
    }));
    return { withdraws: mappedWithdraws };
  }

  // ====== Lấy tất cả yêu cầu rút tiền (cho admin) ======
  async getAllWithdrawRequests(): Promise<ListWithdrawResponse> {
    const withdraws = await this.cashierRepository.find();
    // const withdraws = await this.cashierRepository.find({
    //   where: { status: 'PENDING' },
    //   order: { request_at: 'DESC' }, // sắp xếp mới nhất lên đầu 
    // });
    const mappedWithdraws = withdraws.map(withdraw => ({
      ...withdraw,
      request_at: withdraw.request_at.toISOString(),
      success_at: withdraw.success_at ? withdraw.success_at.toISOString() : '',
    }));
    return { withdraws: mappedWithdraws };
  }

  // ====== Duyệt yêu cầu rút tiền ======
  async approveWithdraw(payload: UpdateWithdrawStatusRequest): Promise<WithdrawResponse> {
    const withdraw = await this.cashierRepository.findOne({ where: { id: payload.id } });
    if (!withdraw) throw new RpcException({ status: status.NOT_FOUND, message: 'Không tìm thấy yêu cầu rút' });

    withdraw.status = 'SUCCESS';
    withdraw.finance_id = payload.finance_id
    withdraw.success_at = new Date();

    const updated = await this.cashierRepository.save(withdraw);

    const key = `rut_tien:${withdraw.user_id}:${withdraw.id}`;;
    await this.cacheManager.del(key)
    
    await this.financeService.createFinanceRecord(
      {
        amount: updated.amount,
        type: "RUT",
        user_id: updated.user_id
      }
    ); // tạo bản ghi trong db finance

    winstonLogger.log({ nhiemVu: 'thongBaoRutTien', userId: updated.user_id, amount: updated.amount, adminId: updated.finance_id })

    return {
      withdraw: {
        ...updated,
        request_at: updated.request_at.toISOString(),
        success_at: updated.success_at ? updated.success_at.toISOString() : '',
      } 
    };
  }

  // ====== Từ chối yêu cầu rút tiền ======
  async rejectWithdraw(payload: UpdateWithdrawStatusRequest): Promise<WithdrawResponse> {
    const withdraw = await this.cashierRepository.findOne({ where: { id: payload.id } });
    if (!withdraw) throw new RpcException({ status: status.NOT_FOUND, message: 'Không tìm thấy yêu cầu rút' });

    withdraw.status = 'ERROR';
    withdraw.finance_id = payload.finance_id;
    withdraw.success_at = new Date();

    const updated = await this.cashierRepository.save(withdraw);

    const payResp = await this.payService.getPay({userId: withdraw.user_id});
    const userBalance = Number(payResp.pay?.tien) || 0;
    const key = `rut_tien:${withdraw.user_id}:${withdraw.id}`;;
    let amount_back = (await this.cacheManager.get<number>(key)) || 0;
    
    await this.payService.updateMoney({userId: withdraw.user_id, amount: amount_back})
    return {
      withdraw: {
        ...updated,
        request_at: updated.request_at.toISOString(),
        success_at: updated.success_at ? updated.success_at.toISOString() : '',
      } 
    };
  }
}
