import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAdminsGuard } from '@shared/auth/guards';
import { AuditLogMeta } from '@shared/decorators';
import {
  ApiReq,
  AuditSeverity,
  AuditType,
  CategoryEntityModules,
} from '@shared/interfaces';
import { Category } from '@shared/schemas';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('admins')
@ApiBearerAuth()
@UseGuards(JwtAdminsGuard)
@Controller('v1/admins/categories')
export class CategoriesAdminsController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @AuditLogMeta({
    action: AuditType.ADMIN,
    description: 'Admin created a new category',
    severity: AuditSeverity.CRITICAL,
  })
  @Post()
  async create(
    @Body() createCategoryDto: CreateCategoryDto,
    @Request() req: ApiReq,
  ): Promise<Category> {
    return this.categoriesService.create(req, createCategoryDto);
  }

  @AuditLogMeta({
    action: AuditType.ADMIN,
    description: 'Admin retrieved all categories',
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
    name: 'categoryByActive',
    required: false,
    type: String,
    enum: ['0', '1'],
  } as any)
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
  @ApiQuery({
    name: 'categoryDateRange',
    required: false,
    type: String,
    description: 'e.g: 2020-11-12,2022-11-15',
  } as any)
  @ApiQuery({ name: 'categorySearch', required: false, type: String } as any)
  @Get()
  async findAll(@Request() req: ApiReq) {
    return this.categoriesService.findAll(req, true);
  }

  @AuditLogMeta({
    action: AuditType.ADMIN,
    description: 'Admin retrieved a specific category',
    severity: AuditSeverity.INFO,
  })
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Category> {
    return this.categoriesService.findOne(id);
  }

  @AuditLogMeta({
    action: AuditType.ADMIN,
    description: 'Admin updated a category',
    severity: AuditSeverity.ERROR,
  })
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @Request() req: ApiReq,
  ): Promise<Category> {
    return this.categoriesService.update(req, id, updateCategoryDto);
  }

  @AuditLogMeta({
    action: AuditType.ADMIN,
    description: 'Admin deleted a category',
    severity: AuditSeverity.CRITICAL,
  })
  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req: ApiReq) {
    return this.categoriesService.remove(req, id);
  }
}
