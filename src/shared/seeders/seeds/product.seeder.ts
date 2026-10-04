import { Injectable, Inject } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { Seeder } from './Seeder';
import {
  Category,
  CategoryModel,
  Product,
  ProductDocument,
} from '../../schemas';
import { EntityModule } from '../../interfaces';
import { generateCode } from '../../utils';
import { productCategories } from './resources/product-categories';

const toSeedKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

type SeedEntry = {
  seedKey: string;
  name: string;
  description: string;
  parentSeedKey: string | null;
};

@Injectable()
export class ProductSeeder implements Seeder {
  constructor(
    @Inject(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @Inject(Category.name)
    private readonly categoryModel: CategoryModel,
  ) {}

  private getSeedEntries() {
    const parents: SeedEntry[] = productCategories.map(
      ({ name, description }) => ({
        seedKey: toSeedKey(name),
        name,
        description,
        parentSeedKey: null,
      }),
    );
    const children: SeedEntry[] = productCategories.flatMap(
      ({ name, subcategories }) =>
        subcategories.map((subcategory) => ({
          seedKey: `${toSeedKey(name)}.${toSeedKey(subcategory)}`,
          name: subcategory,
          description: `${subcategory} in ${name}`,
          parentSeedKey: toSeedKey(name),
        })),
    );
    return { parents, children };
  }

  private async getParentIdBySeedKey(seedKeys: string[]) {
    const parents = await this.categoryModel
      .find({ seedKey: { $in: seedKeys } }, { seedKey: 1 })
      .lean();
    return new Map(parents.map((parent) => [parent.seedKey, parent._id]));
  }

  // Claims categories created before seedKey existed (matched by their original code and parent)
  private claimExisting(entry: SeedEntry, parentId: Types.ObjectId | null) {
    return {
      updateOne: {
        filter: {
          code: generateCode(entry.name),
          module: EntityModule.PRODUCTS,
          parentCategory: parentId,
          seedKey: { $exists: false },
        },
        update: { $set: { seedKey: entry.seedKey } },
      },
    };
  }

  private upsert(entry: SeedEntry, parentId: Types.ObjectId | null) {
    // Matched by seedKey only, so admin renames, moves and deletions are never undone or duplicated
    return {
      updateOne: {
        filter: { seedKey: entry.seedKey },
        update: {
          $setOnInsert: {
            seedKey: entry.seedKey,
            name: entry.name,
            description: entry.description,
            code: generateCode(entry.name),
            module: EntityModule.PRODUCTS,
            parentCategory: parentId,
            isActive: true,
            isDeleted: false,
          },
        },
        upsert: true,
      },
    };
  }

  async seedCategories() {
    const { parents, children } = this.getSeedEntries();
    // Only entries whose seedKey isn't on any category yet may claim an old, key-less category
    const takenSeedKeys = new Set(
      await this.categoryModel.distinct('seedKey', {
        seedKey: { $in: [...parents, ...children].map((e) => e.seedKey) },
      }),
    );
    const unclaimed = (entries: SeedEntry[]) =>
      entries.filter((entry) => !takenSeedKeys.has(entry.seedKey));

    const unclaimedParents = unclaimed(parents);
    if (unclaimedParents.length)
      await this.categoryModel.bulkWrite(
        unclaimedParents.map((entry) => this.claimExisting(entry, null)),
      );
    await this.categoryModel.bulkWrite(
      parents.map((entry) => this.upsert(entry, null)),
    );

    if (!children.length) return;
    const parentIdBySeedKey = await this.getParentIdBySeedKey(
      parents.map((entry) => entry.seedKey),
    );

    const unclaimedChildren = unclaimed(children);
    if (unclaimedChildren.length)
      await this.categoryModel.bulkWrite(
        unclaimedChildren.map((entry) =>
          this.claimExisting(entry, parentIdBySeedKey.get(entry.parentSeedKey)),
        ),
      );
    await this.categoryModel.bulkWrite(
      children.map((entry) =>
        this.upsert(entry, parentIdBySeedKey.get(entry.parentSeedKey)),
      ),
    );
  }

  async seed(): Promise<any> {
    await this.seedCategories();
  }

  async drop(): Promise<unknown> {
    return null;
  }
}
