import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('withdraw_money')
export class Cashier {
  @PrimaryGeneratedColumn()
  id: number;

  // Tạm thời chỉ index userId, nếu sau này cần sort theo request_at(order by)
  // thì cần composite indexing thay vì single indexing
  // composite userId(Selectivity) + request_at(Order by)
  @Index()
  @Column({ nullable: false })
  userId: number;

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
