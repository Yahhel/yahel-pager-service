import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Res,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import { FileService } from './file.service';
import { UploadFileDto } from './dto/upload-file.dto';
import { Response } from 'express';
import { JwtUsersGuard } from '@shared/auth/guards';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ApiReq } from '@shared/interfaces';
import { AuditLogMeta } from '@shared/decorators';
import { AuditSeverity, AuditType } from '@shared/interfaces';
import { RateProfile } from '@shared/rate-limit';

@ApiTags('files')
@ApiBearerAuth()
@Controller('v1/files')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @AuditLogMeta({
    action: AuditType.USER,
    description: 'User uploaded files',
    severity: AuditSeverity.CRITICAL,
  })
  @RateProfile('transactional')
  @Post('upload')
  @ApiOperation({ summary: 'Upload multiple files' })
  @ApiConsumes('multipart/form-data')
  @UseGuards(JwtUsersGuard)
  async uploadFile(
    @Body() { private: isPrivate }: UploadFileDto,
    @Res() resp: Response,
    @Req() req: ApiReq,
  ) {
    const response = await this.fileService.uploadFile(req, isPrivate);
    resp.json(response);
  }

  @AuditLogMeta({
    action: AuditType.USER,
    description: 'User streamed a file',
    severity: AuditSeverity.INFO,
  })
  @ApiQuery({ name: 'fk', required: false, type: String } as any)
  @Get('stream/:fileId')
  @ApiOperation({
    summary: 'Returns a file as a stream',
    description:
      'Public files need no auth. Private files need a signed ?fk= token from the access-link endpoint (one-time for documents, reusable until expiry for audio/video). Supports range requests.',
  })
  async findOne(
    @Param('fileId') fileId: string,
    @Res() resp: Response,
    @Query('fk') fk: string | undefined,
    @Req() req: ApiReq,
  ) {
    const rangeHeader = req.headers.range;
    return this.fileService.getFileStream(fileId, resp, rangeHeader, fk);
  }

  @AuditLogMeta({
    action: AuditType.USER,
    description: 'User generated a signed file link',
    severity: AuditSeverity.WARNING,
  })
  @Get(':fileId/access-link')
  @ApiOperation({
    summary: 'Returns a short-lived signed link to stream a file',
    description: 'Owner only for now; buyer access comes with orders.',
  })
  @UseGuards(JwtUsersGuard)
  async getFileAccessLink(@Param('fileId') fileId: string, @Req() req: ApiReq) {
    return this.fileService.getFileAccessLink(req, fileId);
  }

  @AuditLogMeta({
    action: AuditType.USER,
    description: 'User downloaded a file',
    severity: AuditSeverity.INFO,
  })
  @Get('download/:fileId')
  @ApiOperation({
    summary: 'Downloads a file with proper headers for browser download',
    description:
      'Public files for any logged-in user; private files for their owner only. Supports range requests.',
  })
  @UseGuards(JwtUsersGuard)
  async downloadFile(
    @Param('fileId') fileId: string,
    @Res() resp: Response,
    @Req() req: ApiReq,
  ) {
    const rangeHeader = req.headers.range;
    return this.fileService.downloadFile(req, fileId, resp, rangeHeader);
  }

  @AuditLogMeta({
    action: AuditType.USER,
    description: 'User deleted a file',
    severity: AuditSeverity.ERROR,
  })
  @Delete('delete/:fileId')
  @UseGuards(JwtUsersGuard)
  async remove(@Param('fileId') fileId: string, @Req() req: ApiReq) {
    return await this.fileService.deleteFile(req, fileId);
  }
}
