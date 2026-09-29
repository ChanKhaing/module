import { Global, Module } from '@nestjs/common';
import { PaginationService } from './services/pagination.service';
import { IdService } from './services/id.service';

@Global()
@Module({
  providers: [PaginationService, IdService],
  exports: [PaginationService, IdService],
})
export class SharedModule {}