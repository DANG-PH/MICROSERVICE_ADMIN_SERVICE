import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('withdraw_money')
export class Cashier {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: false })
  user_id: number;

  @Column({ nullable: false })
  amount: number; // số tiền rút

  @Column({ nullable: false })
  bank_name: string; // tên ngân hàng của user

  @Column({ nullable: false })
  bank_number: string; // số tài khoản của user

  @Column({ nullable: false })
  bank_owner: string; // chủ tài khoản

  @Column({ nullable: false, default: "PENDING" })
  status: string; // PENDING, SUCCESS, ERROR

  @Column({nullable:true, default: null })
  finance_id: number; // ai duyệt

  @CreateDateColumn()
  request_at: Date;
  
  @CreateDateColumn({nullable: true})
  success_at: Date; // ngày chuyển tiền
}
