import { Controller, Get } from '@nestjs/common';
import { RawResponse } from '@/common/decorators/raw-response.decorator';
import { DatabaseImgService } from '@/database-img/database-img.service';

@Controller('databaseImg')
@RawResponse()
export class DatabaseImgController {
  constructor(private readonly databaseImgService: DatabaseImgService) {}

  @Get()
  findAll() {
    return this.databaseImgService.findAll();
  }
}
