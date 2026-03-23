import { Test, TestingModule } from '@nestjs/testing';
import { QuoteRequestController } from './quote-request.controller';

describe('QuoteRequestController', () => {
  let controller: QuoteRequestController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuoteRequestController],
    }).compile();

    controller = module.get<QuoteRequestController>(QuoteRequestController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
