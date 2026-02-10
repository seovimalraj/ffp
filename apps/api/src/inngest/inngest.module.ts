import { Module, Global } from '@nestjs/common';
import { ExampleController } from './example.controller';

@Global()
@Module({
  providers: [],
  controllers: [ExampleController],
  exports: [],
})
export class InngestModule {}
