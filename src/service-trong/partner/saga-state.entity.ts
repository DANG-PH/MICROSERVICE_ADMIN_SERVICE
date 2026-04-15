// saga-state.entity.ts
import {Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn} from 'typeorm';

export enum SagaPhase {
  FORWARD = 'FORWARD',
  COMPENSATING = 'COMPENSATING',
  DONE = 'DONE',
  FAILED = 'FAILED',
}

@Entity('saga_state')
export class SagaStateEntity {
  @PrimaryColumn('uuid')
  saga_id: string;

  @Column({ type: 'enum', enum: SagaPhase, default: SagaPhase.FORWARD })
  phase: SagaPhase;

  @Column({ type: 'int', default: 1 })
  attempt: number;

  @Column('jsonb', { default: [] })
  completed_steps: string[];

  @Column({ type: 'text', nullable: true })
  original_password: string | null;

  @Column({ type: 'text', nullable: true })
  original_email: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}