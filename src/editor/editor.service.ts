import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Editor } from './editor.entity';

@Injectable()
export class EditorService {
  constructor(
    @InjectRepository(Editor)
    private readonly editorRepository: Repository<Editor>,
  ) {}

  
}
