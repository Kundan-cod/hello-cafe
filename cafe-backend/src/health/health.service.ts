import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<{
    status: string;
    database: string;
    timestamp: string;
  }> {
    const timestamp = new Date().toISOString();
    let databaseStatus = 'unknown';

    try {
      // Use query that works with both SQLite and PostgreSQL
      await this.prisma.$queryRaw`SELECT 1 as value`;
      databaseStatus = 'connected';
    } catch {
      databaseStatus = 'disconnected';
    }

    const status = databaseStatus === 'connected' ? 'ok' : 'degraded';

    return {
      status,
      database: databaseStatus,
      timestamp,
    };
  }
}
