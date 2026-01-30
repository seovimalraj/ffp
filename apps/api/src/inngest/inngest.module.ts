import { Module, Global } from '@nestjs/common';
import { InngestService } from './inngest.service';
import { ExampleController } from './example.controller';

@Global()
@Module({
  providers: [InngestService],
  controllers: [ExampleController],
  exports: [InngestService],
})
export class InngestModule {}
