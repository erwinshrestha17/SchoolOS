import { IsOptional, IsString } from 'class-validator';

export class BroadcastRouteDelayDto {
  @IsString()
  routeId!: string;

  @IsString()
  message!: string;

  @IsOptional()
  @IsString()
  estimatedDelay?: string;
}
