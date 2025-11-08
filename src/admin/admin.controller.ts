import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { CashierService } from 'src/cashier/cashier.service';
import { FinanceService } from 'src/finance/finance.service';
import { PartnerService } from 'src/partner/partner.service';
import { EditorService } from 'src/editor/editor.service';

@Controller()
export class AdminController {
  constructor(
    private readonly cashierService: CashierService,
    private readonly financeService: FinanceService,
    private readonly partnerService: PartnerService,
    private readonly editorService: EditorService
  ) {}

  
}