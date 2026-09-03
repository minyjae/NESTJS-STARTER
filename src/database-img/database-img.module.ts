import { Module } from '@nestjs/common';
import { DatabaseImgController } from '@/database-img/database-img.controller';
import { DatabaseImgService } from '@/database-img/database-img.service';

@Module({
  controllers: [DatabaseImgController],
  providers: [DatabaseImgService],
})
export class DatabaseImgModule {}
