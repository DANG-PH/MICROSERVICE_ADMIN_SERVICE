import { Injectable, Inject, Logger } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import {
    GetPayByUserIdRequest,
    UpdateMoneyRequest,
    UpdateStatusRequest,
    CreatePayOrderRequest,
    CreatePayRequest,
    PayResponse,
    QrResponse,
    PAY_PACKAGE_NAME,
    PAY_SERVICE_NAME,
    PayServiceClient,
    Pay,
    CreateFinanceRequest,
    GetFinanceByUserRequest,
    FinanceResponse,
    ListFinanceResponse,
    FinanceSummaryResponse,
    FINANCE_SERVICE_NAME,
    FinanceServiceClient,
    Empty
} from 'proto/pay.pb';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class PayService {
  private readonly logger = new Logger(PayService.name);
  private payGrpcService: PayServiceClient;
  private financeGrpcService: FinanceServiceClient;

  constructor(
    @Inject(PAY_PACKAGE_NAME) private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.payGrpcService = this.client.getService<PayServiceClient>(PAY_SERVICE_NAME);
    this.financeGrpcService = this.client.getService<FinanceServiceClient>(FINANCE_SERVICE_NAME);
  }

  async getPay(req: GetPayByUserIdRequest): Promise<PayResponse> {
    return firstValueFrom(this.payGrpcService.getPayByUserId(req));
  }

  async updateMoney(req: UpdateMoneyRequest): Promise<PayResponse> {
    return firstValueFrom(this.payGrpcService.updateMoney(req));
  }

  async createPay(req: CreatePayRequest): Promise<PayResponse> {
    return firstValueFrom(this.payGrpcService.createPay(req));
  }
  
  async updateStatus(req: UpdateStatusRequest): Promise<PayResponse> {
    return firstValueFrom(this.payGrpcService.updateStatus(req));
  }

  async getQr(req: CreatePayOrderRequest): Promise<QrResponse> {
    return firstValueFrom(this.payGrpcService.createPayOrder(req));
  }

  /* Ghi lại dòng tiền khi nạp hoặc rút thành công */
  async handleCreateFinanceRecord(req: CreateFinanceRequest) {
    return firstValueFrom(this.financeGrpcService.createFinanceRecord(req));
  }

  /* Lấy danh sách giao dịch của 1 user */
  async handleGetFinanceByUser(req: GetFinanceByUserRequest) {
    return firstValueFrom(this.financeGrpcService.getFinanceByUser(req));
  }

  /* Lấy tất cả giao dịch (dành cho admin) */
  async handleGetAllFinance(req: Empty) {
    return firstValueFrom(this.financeGrpcService.getAllFinance(req));
  }

  /* Thống kê tổng nạp, tổng rút và số dư */
  async handleGetFinanceSummary(req: Empty) {
    return firstValueFrom(this.financeGrpcService.getFinanceSummary(req));
  }
}
