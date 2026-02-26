import { Test, TestingModule } from '@nestjs/testing';
import { TechnicalSupportService } from './technical-support.service';

describe('TechnicalSupportService', () => {
  let service: TechnicalSupportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TechnicalSupportService],
    }).compile();

    service = module.get<TechnicalSupportService>(TechnicalSupportService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
