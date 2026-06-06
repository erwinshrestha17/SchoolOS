import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CreateDemoRequestDto } from './dto/create-demo-request.dto';
import { DemoRequestsService } from './demo-requests.service';
import {
  DEMO_REQUEST_RATE_LIMIT,
  DEMO_REQUEST_RATE_TTL_MS,
} from './demo-requests.constants';

@Controller('demo-requests')
export class DemoRequestsController {
  constructor(private readonly demoRequestsService: DemoRequestsService) {}

  @Post()
  @Throttle({
    default: {
      limit: DEMO_REQUEST_RATE_LIMIT,
      ttl: DEMO_REQUEST_RATE_TTL_MS,
    },
  })
  create(@Body() dto: CreateDemoRequestDto) {
    return this.demoRequestsService.create(dto);
  }
}
