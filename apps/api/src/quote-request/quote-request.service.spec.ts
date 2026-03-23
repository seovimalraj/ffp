import { Test, TestingModule } from '@nestjs/testing';
import { QuoteRequestService } from './quote-request.service';

describe('QuoteRequestService', () => {
  let service: QuoteRequestService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [QuoteRequestService],
    }).compile();

    service = module.get<QuoteRequestService>(QuoteRequestService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
