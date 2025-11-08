import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('withdraw-money')
export class Cashier {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: false, unique: true })
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

  @Column({ nullable: false, default: "Chưa ai duyệt" })
  finance_id: number; // ai duyệt

  @CreateDateColumn({default: new Date()})
  request_at: Date;
  
  @CreateDateColumn({default: new Date()})
  success_at: Date; // ngày chuyển tiền
}
