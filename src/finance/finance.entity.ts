import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('cash-flow-management')
export class Finance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: false })
  user_id: number;

  @Column({ nullable: false })
  type: string; // NAP hoặc RUT , thao tác với dòng tiền 
  
  @Column({ nullable: false })
  amount: number;

  @CreateDateColumn()
  create_at: Date;
}
