// ─── outbox-event.entity.ts ───────────────────────────────────────────────────
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

// Tại sao đánh index trong case này
// mặc dù status có selectivity thấp nhưng thường thì Popularity nó thấp (vì hầu như bảng đều là done)
// Nên case này ta có thể đánh index cho status
// Composite index (status, nextRetryAt) phục vụ cho outbox poller:
// WHERE status = 'PENDING' AND nextRetryAt <= NOW()
//
// Tại sao composite thay vì 2 index đơn lẻ?
// - Poller luôn filter CẢ HAI điều kiện cùng lúc
// - MySQL dùng 1 composite index hiệu quả hơn merge 2 index riêng
//
// Tại sao status đứng trước nextRetryAt?
// - MySQL dùng index từ trái sang phải
// - Filter status = 'PENDING' trước để loại phần lớn rows (DONE chiếm đa số)
// - Sau đó mới range scan nextRetryAt <= NOW() trên tập nhỏ còn lại
// Thay vì tìm nextRetryAt trước vì hầu như sẽ ra nhiều record hơn
//
// Tại sao status ở đây đáng đánh dù selectivity thấp (4 giá trị)?
// - Khác với role/biBan ở auth, ở đây DONE chiếm đa số sau thời gian chạy
// - Poller chỉ quan tâm PENDING/PROCESSING → lọc được phần lớn bảng
// - Tức là business logic query chỉ quan tâm tới status có popularity ít (ở đây là PENDING/PROCESSING) 
//   còn DONE thì k query
// - Nên là status sẽ luôn trả ít row từ đó nhìn tổng thể thì selectivity cao
// - Kết hợp nextRetryAt làm selectivity tổng thể của composite index cao
@Index(['status', 'nextRetryAt'])
@Entity('outbox_events')
export class OutboxEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sagaType: string; // 'BUY_ACCOUNT'

  @Column('jsonb')
  payload: Record<string, any>;

  @Column({ default: 'PENDING' })
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';

  @Column({ default: 0 })
  retries: number;

  @Column({ default: 3 })
  maxRetries: number;

  @Column({ type: 'timestamptz', nullable: true })
  nextRetryAt: Date | null;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}