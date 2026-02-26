import { Test, TestingModule } from '@nestjs/testing';
import { TechnicalSupportController } from './technical-support.controller';

describe('TechnicalSupportController', () => {
  let controller: TechnicalSupportController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TechnicalSupportController],
    }).compile();

    controller = module.get<TechnicalSupportController>(TechnicalSupportController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
