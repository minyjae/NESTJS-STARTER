import { Module } from '@nestjs/common';
import { HealthController } from '@/domain/health/presentation/health.controller';
import { HealthService } from '@/domain/health/service/health.service';

@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
