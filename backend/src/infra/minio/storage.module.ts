import { Global, Module } from '@nestjs/common';

import { MinioService } from './minio.service';
import { STORAGE_SERVICE } from './storage.interface';

@Global()
@Module({
  providers: [
    MinioService,
    {
      provide: STORAGE_SERVICE,
      useExisting: MinioService,
    },
  ],
  exports: [MinioService, STORAGE_SERVICE],
})
export class StorageModule {}
