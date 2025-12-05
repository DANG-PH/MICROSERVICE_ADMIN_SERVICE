import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { CashierService } from 'src/service-trong/cashier/cashier.service';
import { PartnerService } from 'src/service-trong/partner/partner.service';
import { EditorService } from 'src/service-trong/editor/editor.service';
import type {
  CreatePostRequest,
  DeletePostRequest,
  GetPostByIdRequest,
  GetPostsByEditorRequest,
  UpdatePostRequest,
  UpdatePostStatusRequest,
  PostResponse,
  ListPostResponse,
  GetAllAccountByBuyerResponse,
  GetAllAccountByBuyerRequest,
} from '../../../proto/admin.pb';
import type {
  CreateWithdrawRequestt,
  GetWithdrawsByUserRequest,
  UpdateWithdrawStatusRequest,
  WithdrawResponse,
  ListWithdrawResponse,
} from '../../../proto/admin.pb';
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
  BuyAccountRequest
} from '../../../proto/admin.pb';
import { EDITOR_SERVICE_NAME, 
         CASHIER_SERVICE_NAME, 
         PARTNER_SERVICE_NAME 
} from '../../../proto/admin.pb';

@Controller()
export class AdminController {
  constructor(
    private readonly cashierService: CashierService,
    private readonly partnerService: PartnerService,
    private readonly editorService: EditorService
  ) {}

  // ===== Editor RPC =====
  @GrpcMethod( EDITOR_SERVICE_NAME, 'CreatePost')
  async createPost(payload: CreatePostRequest): Promise<PostResponse> {
    return this.editorService.createPost(payload);
  }

  @GrpcMethod( EDITOR_SERVICE_NAME, 'GetAllPosts')
  async getAllPosts(): Promise<ListPostResponse> {
    return this.editorService.getAllPosts();
  }

  @GrpcMethod( EDITOR_SERVICE_NAME, 'GetPostById')
  async getPostById(payload: GetPostByIdRequest): Promise<PostResponse> {
    return this.editorService.getPostById(payload);
  }

  @GrpcMethod( EDITOR_SERVICE_NAME, 'UpdatePost')
  async updatePost(payload: UpdatePostRequest): Promise<PostResponse> {
    return this.editorService.updatePost(payload);
  }

  @GrpcMethod( EDITOR_SERVICE_NAME, 'DeletePost')
  async deletePost(payload: DeletePostRequest): Promise<PostResponse> {
    return this.editorService.deletePost(payload);
  }

  @GrpcMethod( EDITOR_SERVICE_NAME, 'LockPost')
  async lockPost(payload: UpdatePostStatusRequest): Promise<PostResponse> {
    return this.editorService.lockPost(payload);
  }

  @GrpcMethod( EDITOR_SERVICE_NAME, 'UnlockPost')
  async unlockPost(payload: UpdatePostStatusRequest): Promise<PostResponse> {
    return this.editorService.unlockPost(payload);
  }

  @GrpcMethod( EDITOR_SERVICE_NAME, 'GetPostsByEditor')
  async getPostsByEditor(payload: GetPostsByEditorRequest): Promise<ListPostResponse> {
    return this.editorService.getPostsByEditor(payload);
  }
  

  // ===== Cashier RPC =====
  @GrpcMethod(CASHIER_SERVICE_NAME, 'CreateWithdrawRequest')
  async createWithdrawRequest(payload: CreateWithdrawRequestt): Promise<WithdrawResponse> {
    return this.cashierService.createWithdrawRequest(payload);
  }

  @GrpcMethod(CASHIER_SERVICE_NAME, 'GetWithdrawsByUser')
  async getWithdrawsByUser(payload: GetWithdrawsByUserRequest): Promise<ListWithdrawResponse> {
    return this.cashierService.getWithdrawsByUser(payload);
  }

  @GrpcMethod(CASHIER_SERVICE_NAME, 'GetAllWithdrawRequests')
  async getAllWithdrawRequests(): Promise<ListWithdrawResponse> {
    return this.cashierService.getAllWithdrawRequests();
  }

  @GrpcMethod(CASHIER_SERVICE_NAME, 'ApproveWithdraw')
  async approveWithdraw(payload: UpdateWithdrawStatusRequest): Promise<WithdrawResponse> {
    return this.cashierService.approveWithdraw(payload);
  }

  @GrpcMethod(CASHIER_SERVICE_NAME, 'RejectWithdraw')
  async rejectWithdraw(payload: UpdateWithdrawStatusRequest): Promise<WithdrawResponse> {
    return this.cashierService.rejectWithdraw(payload);
  }

  // ===== Partner RPC =====
  @GrpcMethod(PARTNER_SERVICE_NAME, 'CreateAccountSell')
  async createAccountSell(payload: CreateAccountSellRequest): Promise<AccountSellResponse> {
    return this.partnerService.createAccountSell(payload);
  }

  @GrpcMethod(PARTNER_SERVICE_NAME, 'UpdateAccountSell')
  async updateAccountSell(payload: UpdateAccountSellRequest): Promise<AccountSellResponse> {
    return this.partnerService.updateAccountSell(payload);
  }

  @GrpcMethod(PARTNER_SERVICE_NAME, 'DeleteAccountSell')
  async deleteAccountSell(payload: DeleteAccountSellRequest): Promise<AccountSellResponse> {
    return this.partnerService.deleteAccountSell(payload);
  }

  @GrpcMethod(PARTNER_SERVICE_NAME, 'GetAllActiveAccounts')
  async getAllActiveAccounts(): Promise<ListAccountSellResponse> {
    return this.partnerService.getAllActiveAccounts();
  }

  @GrpcMethod(PARTNER_SERVICE_NAME, 'GetAccountsByPartner')
  async getAccountsByPartner(payload: GetAccountsByPartnerRequest): Promise<ListAccountSellResponse> {
    return this.partnerService.getAccountsByPartner(payload);
  }

  @GrpcMethod(PARTNER_SERVICE_NAME, 'GetAccountById')
  async getAccountById(payload: GetAccountByIdRequest): Promise<AccountSellResponse> {
    return this.partnerService.getAccountById(payload);
  }

  @GrpcMethod(PARTNER_SERVICE_NAME, 'MarkAccountAsSold')
  async markAccountAsSold(payload: UpdateAccountStatusRequest): Promise<AccountSellResponse> {
    return this.partnerService.markAccountAsSold(payload);
  }

  @GrpcMethod(PARTNER_SERVICE_NAME, 'BuyAccount')
  async buyAccount(payload: BuyAccountRequest): Promise<AccountInformationResponse> {
    return this.partnerService.buyAccountSaga(payload);
  }

  @GrpcMethod(PARTNER_SERVICE_NAME, 'GetAllAccountByBuyer')
  async getAllAccountByBuyer(payload: GetAllAccountByBuyerRequest): Promise<GetAllAccountByBuyerResponse> {
    return this.partnerService.getAllAccountByBuyer(payload);
  }
}