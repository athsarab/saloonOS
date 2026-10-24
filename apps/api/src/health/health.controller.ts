import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DatabaseService } from '../database/database.service';

@ApiTags('system')
@Controller()
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get('health')
  @ApiOperation({ summary: 'Check API and database readiness' })
  @ApiResponse({ status: 200, description: 'API is ready' })
  @ApiResponse({ status: 503, description: 'Database is unavailable' })
  async health() {
    try {
      await this.database.checkConnection();
      return { status: 'ok', database: 'connected', timestamp: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'unavailable' });
    }
  }
}
