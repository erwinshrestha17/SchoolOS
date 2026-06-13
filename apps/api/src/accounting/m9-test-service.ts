import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class M9TestService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.chartAccount.findMany();
  }
}
