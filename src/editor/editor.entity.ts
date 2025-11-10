import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('posts')
export class Editor {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: false })
  title: string;

  @Column({ nullable: false })
  url_anh: string; 

  @Column({ nullable: false })
  editor_id: number;  // dùng để truy vấn xem ai viết bài

  @Column({ nullable: false }) 
  editor_realname: string; // dùng để hiển thị xem ai viết bài

  @Column({ nullable: false, default: "ACTIVE" })
  status: string; // ACTIVE hoặc LOCKED

  @CreateDateColumn()
  create_at: Date;
  
  @UpdateDateColumn()
  update_at: Date; 
}
