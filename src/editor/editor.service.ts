import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Editor } from './editor.entity';
import {
  CreatePostRequest,
  DeletePostRequest,
  GetPostByIdRequest,
  GetPostsByEditorRequest,
  UpdatePostRequest,
  UpdatePostStatusRequest,
  PostResponse,
  ListPostResponse,
} from '../../proto/admin.pb';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';

@Injectable()
export class EditorService {
  constructor(
    @InjectRepository(Editor)
    private readonly editorRepository: Repository<Editor>,
  ) {}

   // ====== Tạo bài viết ======
  async createPost(payload: CreatePostRequest): Promise<PostResponse> {
    const newPost = this.editorRepository.create({
      title: payload.title,
      url_anh: payload.url_anh,
      editor_id: payload.editor_id,
      editor_realname: payload.editor_realname,
      status: 'ACTIVE',
      create_at: new Date(),
      update_at: new Date(),
    });
    const saved = await this.editorRepository.save(newPost);
    return { 
      post: {
        ...saved,
        create_at: saved.create_at.toISOString(),
        update_at: saved.update_at.toISOString(),
      },
    };
  }

  // ====== Lấy tất cả bài viết ======
  async getAllPosts(): Promise<ListPostResponse> {
    const posts = await this.editorRepository.find();
    const mappedPosts = posts.map(post => ({
      ...post,
      create_at: post.create_at.toISOString(),
      update_at: post.update_at.toISOString(),
    }));
    return { posts: mappedPosts };
  }

  // ====== Lấy bài viết theo ID ======
  async getPostById(payload: GetPostByIdRequest): Promise<PostResponse> {
    const post = await this.editorRepository.findOne({ where: { id: payload.id } });
    if (!post) throw new RpcException({status: status.NOT_FOUND, message: 'Không tìm thấy bài viết'});
    return { 
      post: {
        ...post,
        create_at: post.create_at.toISOString(),
        update_at: post.update_at.toISOString(),
      },
    };
  }

  // ====== Cập nhật bài viết ======
  async updatePost(payload: UpdatePostRequest): Promise<PostResponse> {
    const post = await this.editorRepository.findOne({ where: { id: payload.id } });
    if (!post) throw new RpcException({status: status.NOT_FOUND, message: 'Không tìm thấy bài viết'});;

    post.title = payload.title ?? post.title;
    post.url_anh = payload.url_anh ?? post.url_anh;
    post.update_at = new Date();

    const updated = await this.editorRepository.save(post);
    return { 
      post: {
        ...updated,
        create_at: updated.create_at.toISOString(),
        update_at: updated.update_at.toISOString(),
      },
    };
  }

  // ====== Xóa bài viết ======
  async deletePost(payload: DeletePostRequest): Promise<PostResponse> {
    const post = await this.editorRepository.findOne({ where: { id: payload.id } });
    if (!post) throw new RpcException({status: status.NOT_FOUND, message: 'Không tìm thấy bài viết'});;
    await this.editorRepository.remove(post);
    return { 
      post: {
        ...post,
        create_at: post.create_at.toISOString(),
        update_at: post.update_at.toISOString(),
      },
    };
  }

  // ====== Khóa bài viết ======
  async lockPost(payload: UpdatePostStatusRequest): Promise<PostResponse> {
    const post = await this.editorRepository.findOne({ where: { id: payload.id } });
    if (!post) throw new RpcException({status: status.NOT_FOUND, message: 'Không tìm thấy bài viết'});;
    post.status = 'LOCKED';
    post.update_at = new Date();
    const updated = await this.editorRepository.save(post);
    return { 
      post: {
        ...updated,
        create_at: updated.create_at.toISOString(),
        update_at: updated.update_at.toISOString(),
      },
    };
  }

  // ====== Mở khóa bài viết ======
  async unlockPost(payload: UpdatePostStatusRequest): Promise<PostResponse> {
    const post = await this.editorRepository.findOne({ where: { id: payload.id } });
    if (!post) throw new RpcException({status: status.NOT_FOUND, message: 'Không tìm thấy bài viết'});;
    post.status = 'ACTIVE';
    post.update_at = new Date();
    const updated = await this.editorRepository.save(post);
    return { 
      post: {
        ...updated,
        create_at: updated.create_at.toISOString(),
        update_at: updated.update_at.toISOString(),
      },
    };
  }

  // ====== Lấy bài viết theo Editor ======
  async getPostsByEditor(payload: GetPostsByEditorRequest): Promise<ListPostResponse> {
    const posts = await this.editorRepository.find({
      where: { editor_id: payload.editor_id },
    });
    const mappedPosts = posts.map(post => ({
      ...post,
      create_at: post.create_at.toISOString(),
      update_at: post.update_at.toISOString(),
    }));
    return { posts: mappedPosts };
  }
}
