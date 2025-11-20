import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Editor } from './editor.entity';
import { EditorService } from './editor.service';

@Module({
  imports: [TypeOrmModule.forFeature([Editor])], 
  providers: [EditorService],                  
  controllers: [],            
  exports: [EditorService],
})
export class EditorModule {}
