import { Controller, Delete, Get, Param, Post, Request } from '@nestjs/common';
import { DataLogsService } from './data.logs.service';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { ApiReq, dataLogTypes, logLevels } from '../interfaces';

@Controller()
export class DataLogsController {
  constructor(private readonly logsService: DataLogsService) {}

  @ApiQuery({ name: 'limit', required: false, type: String } as any)
  @ApiQuery({ name: 'page', required: false, type: String } as any)
  @ApiQuery({
    name: 'order',
    required: false,
    type: String,
    enum: ['ASC', 'DESC'],
  } as any)
  @ApiQuery({
    name: 'logTraceIds',
    required: false,
    type: String,
  } as any)
  @ApiQuery({
    name: 'logSearch',
    required: false,
    type: String,
  } as any)
  @ApiQuery({
    name: 'logLevels',
    required: false,
    description: `Supported LogLevel: ${logLevels}`,
    type: String,
  } as any)
  @ApiQuery({
    name: 'logTypes',
    required: false,
    type: String,
    description: `Separated by comma. ${dataLogTypes}`,
  } as any)
  @ApiQuery({
    name: 'logApiMethods',
    required: false,
    type: String,
  } as any)
  @ApiQuery({
    name: 'logStatusCodes',
    required: false,
    type: String,
  } as any)
  @ApiQuery({
    name: 'logIpAddresses',
    required: false,
    type: String,
  } as any)
  @ApiQuery({
    name: 'dataLogDateRange',
    required: false,
    type: String,
    description: 'e.g: 2020-11-12,2022-11-15',
  } as any)
  @ApiTags('admins')
  @Get('admins/data-logs')
  findAll(@Request() req: ApiReq) {
    return this.logsService.findAll(req);
  }

  @ApiTags('admins')
  @Post('admins/:logSource/logs')
  logAdmin(@Request() req: ApiReq, @Param('logSource') source: string) {
    return this.logsService.publicLog(req, source);
  }

  @ApiTags('admins')
  @Delete('admins/data-logs/:dataLogId')
  remove(@Param('dataLogId') dataLogId: string) {
    return this.logsService.remove(dataLogId);
  }
}
