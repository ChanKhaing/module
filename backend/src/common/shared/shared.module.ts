import { Global, Module } from '@nestjs/common';
import { PaginationService } from './services/pagination.service';
import { IdService } from './services/id.service';
import { PermissionService } from './services/permission.service';   // ← အသစ်

@Global()
@Module({
  providers: [PaginationService, IdService, PermissionService],       // ← ထည့်
  exports: [PaginationService, IdService, PermissionService],         // ← ထည့်
})
export class SharedModule {}