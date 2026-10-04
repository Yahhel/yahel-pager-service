import { Controller, Get, Param, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtUsersGuard } from '@shared/auth/guards';
import { AuditLogMeta } from '@shared/decorators';
import {
  ApiReq,
  AuditSeverity,
  AuditType,
  CategoryEntityModules,
} from '@shared/interfaces';
import { Category } from '@shared/schemas';
import { CategoriesService } from './categories.service';

@ApiTags('categories')
@ApiBearerAuth()
@UseGuards(JwtUsersGuard)
@Controller('v1/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @AuditLogMeta({
    action: AuditType.USER,
    description: 'User retrieved all categories',
    severity: AuditSeverity.INFO,
  })
  @ApiQuery({ name: 'limit', required: false, type: String } as any)
  @ApiQuery({ name: 'page', required: false, type: String } as any)
  @ApiQuery({
    name: 'order',
    required: false,
    type: String,
    enum: ['ASC', 'DESC'],
  } as any)
  @ApiQuery({ name: 'categoryByIds', required: false, type: String } as any)
  @ApiQuery({ name: 'categoryByCode', required: false, type: String } as any)
  @ApiQuery({
    name: 'categoryByParentIds',
    required: false,
    type: String,
  } as any)
  @ApiQuery({
    name: 'categoryByModules',
    required: false,
    type: String,
    enum: CategoryEntityModules,
  } as any)
  @ApiQuery({ name: 'categorySearch', required: false, type: String } as any)
  @Get()
  async findAll(@Request() req: ApiReq) {
    return this.categoriesService.findAll(req);
  }

  @AuditLogMeta({
    action: AuditType.USER,
    description: 'User retrieved a specific category',
    severity: AuditSeverity.INFO,
  })
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Category> {
    return this.categoriesService.findOne(id, false);
  }
}
