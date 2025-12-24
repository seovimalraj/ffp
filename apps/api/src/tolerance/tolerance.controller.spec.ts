import { Test, TestingModule } from '@nestjs/testing';
import { ToleranceController } from './tolerance.controller';

describe('ToleranceController', () => {
  let controller: ToleranceController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ToleranceController],
    }).compile();

    controller = module.get<ToleranceController>(ToleranceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
