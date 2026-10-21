import { Module } from '@nestjs/common';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';
import { StudioClock } from './studio-clock';

@Module({
  controllers: [AvailabilityController],
  providers: [AvailabilityService, StudioClock],
  exports: [AvailabilityService, StudioClock],
})
export class AvailabilityModule {}
