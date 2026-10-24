import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('system')
@Controller('system')
export class SystemController {
  constructor(private readonly config: ConfigService) {}

  @Get('version')
  @ApiOperation({ summary: 'Return the running API version' })
  version() {
    return {
      name: 'SalonOS API',
      version: this.config.getOrThrow<string>('APP_VERSION'),
      environment: this.config.getOrThrow<string>('NODE_ENV'),
    };
  }
}
