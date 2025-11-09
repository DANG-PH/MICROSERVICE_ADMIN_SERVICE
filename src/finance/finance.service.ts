import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Finance } from './finance.entity';
import {
  CreateFinanceRequest,
  GetFinanceByUserRequest,
  FinanceResponse,
  ListFinanceResponse,
  FinanceSummaryResponse,
} from '../../proto/admin.pb';

@Injectable()
export class FinanceService {
  constructor(
    @InjectRepository(Finance)
    private readonly financeRepository: Repository<Finance>,
  ) {}
  // ===== Tạo bản ghi giao dịch =====
  async createFinanceRecord(payload: CreateFinanceRequest): Promise<FinanceResponse> {
    const newRecord = this.financeRepository.create({
      user_id: payload.user_id,
      type: payload.type,
      amount: payload.amount,
      create_at: new Date(),
    });

    const saved = await this.financeRepository.save(newRecord);

    return {
      finance: {
        ...saved,
        create_at: saved.create_at.toISOString(),
      },
    };
  }

  // ===== Lấy giao dịch theo user =====
  async getFinanceByUser(payload: GetFinanceByUserRequest): Promise<ListFinanceResponse> {
    const finances = await this.financeRepository.find({ where: { user_id: payload.user_id } });
    const mappedFinances = finances.map(fin => ({
      ...fin,
      create_at: fin.create_at.toISOString(),
    }));
    return { finances: mappedFinances };
  }

  // ===== Lấy tất cả giao dịch =====
  async getAllFinance(): Promise<ListFinanceResponse> {
    const finances = await this.financeRepository.find();
    const mappedFinances = finances.map(fin => ({
      ...fin,
      create_at: fin.create_at.toISOString(),
    }));
    return { finances: mappedFinances };
  }

  // ===== Thống kê tổng nạp, tổng rút, balance =====
  async getFinanceSummary(): Promise<FinanceSummaryResponse> {
    const finances = await this.financeRepository.find();

    const total_nap = finances
      .filter(f => f.type === 'NAP')
      .reduce((sum, f) => sum + f.amount, 0);

    const total_rut = finances
      .filter(f => f.type === 'RUT')
      .reduce((sum, f) => sum + f.amount, 0);

    return {
      total_nap,
      total_rut,
      balance: total_nap - total_rut,
    };
  }
}
