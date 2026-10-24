import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/auth.decorators';

@ApiTags('system')
@Controller('system')
export class SystemController {
  constructor(private readonly config: ConfigService) {}

  @Get('version')
  @Public()
  @ApiOperation({ summary: 'Return the running API version' })
  version() {
    return {
      name: 'SalonOS API',
      version: this.config.getOrThrow<string>('APP_VERSION'),
    };
  }
}
