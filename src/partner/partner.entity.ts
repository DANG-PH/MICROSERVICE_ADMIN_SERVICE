import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('accounts-sell')
export class Partner {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: false, unique: true })
  username: string;

  @Column({ nullable: false })
  password: string;

  @Column({ nullable: false })
  url: string; // link ảnh tổng quát của acc

  @Column({ nullable: false })
  description: string; // mô tả tổng quát của acc để user mua acc xem

  @Column({ nullable: false })
  price: number;

  @Column({ nullable: false, default: "ACTIVE" })
  status: string; // SOLD, ACTIVE

  @Column({ nullable: false })
  partner_id: string; // ai đăng bán acc

  @CreateDateColumn({default: new Date()})
  createdAt: Date;
}
