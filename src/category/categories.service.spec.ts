import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { EntityModule } from '@shared/interfaces';
import { CategoriesService } from './categories.service';

const ADMIN_ID = new Types.ObjectId();
const req: any = { user: { _id: ADMIN_ID.toString() } };

const query = (value: any) => {
  const q: any = {
    populate: jest.fn(() => q),
    lean: jest.fn(() => Promise.resolve(value)),
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
  return q;
};

describe('CategoriesService', () => {
  let categoryModel: any;
  let service: CategoriesService;

  beforeEach(() => {
    categoryModel = {
      exists: jest.fn().mockResolvedValue(null),
      create: jest.fn(async (doc) => ({ _id: new Types.ObjectId(), ...doc })),
      findOne: jest.fn(() => query(null)),
      findOneAndUpdate: jest.fn(() => query({ name: 'Updated' })),
      updateOne: jest.fn(),
    };
    service = new CategoriesService(categoryModel);
  });

  describe('create', () => {
    it('creates a top-level category with a generated code', async () => {
      await service.create(req, {
        name: ' E-books ',
        module: EntityModule.PRODUCTS,
      });

      expect(categoryModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'E-books',
          code: 'e_books',
          module: 'products',
          parentCategory: null,
          isActive: true,
          createdBy: ADMIN_ID,
        }),
      );
    });

    it('rejects duplicates within the same module and parent', async () => {
      categoryModel.exists.mockResolvedValue({ _id: 'existing' });
      await expect(
        service.create(req, { name: 'Ebooks', module: EntityModule.PRODUCTS }),
      ).rejects.toThrow("Category with name 'Ebooks' already exists");
      expect(categoryModel.exists).toHaveBeenCalledWith(
        expect.objectContaining({ isDeleted: false, parentCategory: null }),
      );
    });

    it('only allows a top-level parent from the same module', async () => {
      const parentId = new Types.ObjectId().toString();

      categoryModel.findOne.mockReturnValueOnce(query(null));
      await expect(
        service.create(req, {
          name: 'Novels',
          module: EntityModule.PRODUCTS,
          parentCategoryId: parentId,
        }),
      ).rejects.toThrow('not found');

      categoryModel.findOne.mockReturnValueOnce(
        query({ module: 'products', parentCategory: new Types.ObjectId() }),
      );
      await expect(
        service.create(req, {
          name: 'Novels',
          module: EntityModule.PRODUCTS,
          parentCategoryId: parentId,
        }),
      ).rejects.toThrow('must be a top-level category');

      categoryModel.findOne.mockReturnValueOnce(
        query({ module: 'products', parentCategory: null }),
      );
      await service.create(req, {
        name: 'Novels',
        module: EntityModule.PRODUCTS,
        parentCategoryId: parentId,
      });
      expect(categoryModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          parentCategory: new Types.ObjectId(parentId),
        }),
      );
    });
  });

  describe('update', () => {
    const id = new Types.ObjectId().toString();

    beforeEach(() => {
      categoryModel.findOne.mockImplementation((filter) =>
        filter._id?.toString() === id
          ? query({
              _id: new Types.ObjectId(id),
              name: 'Ebooks',
              code: 'ebooks',
              module: 'products',
              parentCategory: null,
            })
          : query({ module: 'products', parentCategory: null }),
      );
    });

    it('regenerates the code when the name changes', async () => {
      await service.update(req, id, { name: 'Digital Books' });
      expect(
        categoryModel.findOneAndUpdate.mock.calls[0][1].$set,
      ).toMatchObject({
        name: 'Digital Books',
        code: 'digital_books',
        updatedBy: ADMIN_ID,
      });
    });

    it('refuses to make a category its own parent', async () => {
      await expect(
        service.update(req, id, { parentCategoryId: id }),
      ).rejects.toThrow('cannot be its own parent');
    });

    it('refuses to move a category that has subcategories', async () => {
      categoryModel.exists.mockImplementation(async (filter) =>
        filter.parentCategory?.toString() === id ? { _id: 'child' } : null,
      );
      await expect(
        service.update(req, id, {
          parentCategoryId: new Types.ObjectId().toString(),
        }),
      ).rejects.toThrow('cannot be moved under another category');
    });
  });

  describe('remove', () => {
    it('soft deletes a category without children', async () => {
      const id = new Types.ObjectId().toString();
      categoryModel.exists.mockImplementation(async (filter) =>
        filter._id ? { _id: id } : null,
      );

      await expect(service.remove(req, id)).resolves.toEqual({
        message: 'Category deleted successfully',
      });
      expect(categoryModel.updateOne.mock.calls[0][1].$set).toMatchObject({
        isDeleted: true,
        updatedBy: ADMIN_ID,
      });
    });

    it('refuses to delete a category with children', async () => {
      categoryModel.exists.mockResolvedValue({ _id: 'x' });
      await expect(
        service.remove(req, new Types.ObjectId().toString()),
      ).rejects.toThrow('It has child categories');
    });

    it('returns 404 for unknown categories and 400 for bad ids', async () => {
      await expect(
        service.remove(req, new Types.ObjectId().toString()),
      ).rejects.toThrow(NotFoundException);
      await expect(service.remove(req, 'nope')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
