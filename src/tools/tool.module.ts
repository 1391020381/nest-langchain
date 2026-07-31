import { Module } from '@nestjs/common';
import { ToolkitService } from './toolkit.service';

@Module({
  providers: [ToolkitService],
  exports: [ToolkitService],
})
export class ToolModule {}
