import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private prisma: PrismaService) {}

  async check(): Promise<any> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  async checkDatabase(): Promise<any> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'connected',
      };
    } catch (error) {
      this.logger.error('Database connection failed', error);
      return {
        status: 'error',
        database: 'disconnected',
        error: error.message,
      };
    }
  }

  async checkDiskSpace(): Promise<any> {
    const fs = require('fs');
    const path = require('path');
    
    try {
      const uploadDir = path.join(__dirname, '../../../uploads');
      
      // Try to create directory if it doesn't exist
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      return {
        status: 'ok',
        disk: 'available',
      };
    } catch (error) {
      this.logger.error('Disk check failed', error);
      return {
        status: 'error',
        disk: 'unavailable',
        error: error.message,
      };
    }
  }

  async checkAll(): Promise<any> {
    const [base, db, disk] = await Promise.all([
      this.check(),
      this.checkDatabase(),
      this.checkDiskSpace(),
    ]);

    const overallStatus = 
      base.status === 'ok' && 
      db.status === 'ok' && 
      disk.status === 'ok' 
        ? 'healthy' 
        : 'degraded';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        base: base,
        database: db,
        disk: disk,
      },
    };
  }
}
