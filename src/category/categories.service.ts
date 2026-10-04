import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { ApiReq, CATEGORY_PUBLIC_FIELDS } from '@shared/interfaces';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category, CategoryDocument, CategoryModel } from '@shared/schemas';
import {
  generateCode,
  getPaginated,
  getPagingParams,
  isValidObjectId,
  stripEmptyFields,
} from '@shared/utils';

@Injectable()
export class CategoriesService {
  constructor(
    @Inject(Category.name)
    private readonly categoryModel: CategoryModel,
  ) {}

  // Categories are two levels deep (category -> subcategory), which also rules out parent cycles
  private async validateParentCategory(
    parentCategoryId: string,
    module: string,
  ) {
    const parentCategory = await this.categoryModel
      .findOne(
        { _id: new Types.ObjectId(parentCategoryId), isDeleted: false },
        { module: 1, parentCategory: 1 },
      )
      .lean();

    if (!parentCategory) {
      throw new BadRequestException(
        `Parent category with ID '${parentCategoryId}' not found`,
      );
    }

    if (parentCategory.module !== module) {
      throw new BadRequestException(
        `Parent category must belong to the same module`,
      );
    }

    if (parentCategory.parentCategory) {
      throw new BadRequestException(
        `Parent category must be a top-level category`,
      );
    }
  }

  async create(
    req: ApiReq,
    createCategoryDto: CreateCategoryDto,
  ): Promise<Category> {
    const { name, module, parentCategoryId } = createCategoryDto;
    const code = generateCode(name.trim());
    const parentCategory = parentCategoryId
      ? new Types.ObjectId(parentCategoryId)
      : null;

    const [existingCategory] = await Promise.all([
      this.categoryModel.exists({
        code,
        module,
        parentCategory,
        isDeleted: false,
      }),
      parentCategoryId
        ? this.validateParentCategory(parentCategoryId, module)
        : Promise.resolve(),
    ]);

    if (existingCategory) {
      throw new BadRequestException(
        `Category with name '${name}' already exists in this module`,
      );
    }

    return this.categoryModel.create({
      name: name.trim(),
      description: createCategoryDto.description,
      module,
      isActive: createCategoryDto.isActive ?? true,
      code,
      parentCategory,
      createdBy: new Types.ObjectId(req.user._id),
    });
  }

  // Users only see active categories and public fields; admins see everything not deleted
  async findAll(req: ApiReq, isAdmin = false) {
    const { page, currentLimit, skip, order, dbQuery } = getPagingParams(req, {
      isDeleted: false,
      ...(!isAdmin && { isActive: true }),
    });

    const [records, count] = await Promise.all([
      this.categoryModel
        .find(dbQuery, isAdmin ? {} : CATEGORY_PUBLIC_FIELDS, { lean: true })
        .sort({ createdAt: order })
        .skip(skip)
        .limit(currentLimit)
        .populate({
          path: 'parentCategory',
          model: this.categoryModel,
          select: 'name code',
        })
        .lean(),
      this.categoryModel.countDocuments(dbQuery),
    ] as any);

    return getPaginated<CategoryDocument>(
      { page, count, limit: currentLimit },
      records,
    );
  }

  async findOne(id: string, isAdmin = true): Promise<Category> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid identification provisioned.');
    }

    const category = await this.categoryModel
      .findOne(
        {
          _id: new Types.ObjectId(id),
          isDeleted: false,
          ...(!isAdmin && { isActive: true }),
        },
        isAdmin ? {} : CATEGORY_PUBLIC_FIELDS,
      )
      .populate({
        path: 'parentCategory',
        model: this.categoryModel,
        select: 'name code',
      });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return category;
  }

  async update(
    req: ApiReq,
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category> {
    const { name, parentCategoryId } = updateCategoryDto;
    const category = await this.findOne(id);

    const nameChanged = name && name.trim() !== category.name;
    const parentChanged =
      parentCategoryId &&
      parentCategoryId !== category.parentCategory?.['_id']?.toString();

    if (parentCategoryId === id) {
      throw new BadRequestException('A category cannot be its own parent');
    }

    const code = nameChanged ? generateCode(name.trim()) : category.code;
    const parentCategory = parentChanged
      ? new Types.ObjectId(parentCategoryId)
      : (category.parentCategory?.['_id'] ?? null);

    const [existingCategory, hasChildren] = await Promise.all([
      nameChanged || parentChanged
        ? this.categoryModel.exists({
            code,
            module: category.module,
            parentCategory,
            isDeleted: false,
            _id: { $ne: new Types.ObjectId(id) },
          })
        : Promise.resolve(null),
      parentChanged
        ? this.categoryModel.exists({
            parentCategory: new Types.ObjectId(id),
            isDeleted: false,
          })
        : Promise.resolve(null),
      parentChanged
        ? this.validateParentCategory(parentCategoryId, category.module)
        : Promise.resolve(),
    ]);

    if (existingCategory) {
      throw new BadRequestException(
        `Category with name '${name ?? category.name}' already exists here`,
      );
    }

    if (hasChildren) {
      throw new BadRequestException(
        'A category with subcategories cannot be moved under another category',
      );
    }

    return this.categoryModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), isDeleted: false },
        {
          $set: stripEmptyFields({
            name: name?.trim(),
            code: nameChanged ? code : undefined,
            description: updateCategoryDto.description,
            isActive: updateCategoryDto.isActive,
            parentCategory: parentChanged ? parentCategory : undefined,
            updatedBy: new Types.ObjectId(req.user._id),
          }),
        },
        { new: true },
      )
      .populate({
        path: 'parentCategory',
        model: this.categoryModel,
        select: 'name code',
      });
  }

  async remove(req: ApiReq, id: string): Promise<{ message: string }> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid identification provisioned.');
    }
    const categoryId = new Types.ObjectId(id);

    const [category, hasChildren] = await Promise.all([
      this.categoryModel.exists({ _id: categoryId, isDeleted: false }),
      this.categoryModel.exists({
        parentCategory: categoryId,
        isDeleted: false,
      }),
    ]);

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    if (hasChildren) {
      throw new BadRequestException(
        `Cannot delete category: It has child categories`,
      );
    }

    await this.categoryModel.updateOne(
      { _id: categoryId },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          updatedBy: new Types.ObjectId(req.user._id),
        },
      },
    );

    return { message: 'Category deleted successfully' };
  }
}
