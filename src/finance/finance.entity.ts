import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('cash-flow-management')
export class Finance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: false, unique: true })
  user_id: number;

  @Column({ nullable: false })
  type: string; // NAP hoặc RUT , thao tác với dòng tiền 
  
  @Column({ nullable: false })
  amount: number;

  @CreateDateColumn({default: new Date()})
  create_at: Date;
}
