import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Model, Types } from 'mongoose';
import { EntityModule } from '../interfaces';

export type CategoryDocument = HydratedDocument<Category>;

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface CategoryModel extends Model<CategoryDocument> {}

@Schema({ timestamps: true })
export class Category {
  @Prop({ required: true, index: true })
  name: string;

  @Prop()
  description: string;

  @Prop({ required: true, index: true })
  code: string;

  @Prop({ type: String, enum: EntityModule, required: true, index: true })
  module: EntityModule;

  @Prop({ type: Types.ObjectId, ref: 'Category', default: null, index: true })
  parentCategory: Category | Types.ObjectId;

  @Prop({ default: true })
  isActive: boolean;

  // Set only on seeded categories; admin edits never change it, so re-seeding can't duplicate them
  @Prop({ type: String })
  seedKey?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy: Types.ObjectId;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;

  declare createdAt: Date;
  declare updatedAt: Date;
}

export const CategorySchema = SchemaFactory.createForClass(Category);

CategorySchema.index(
  { code: 1, module: 1, parentCategory: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
CategorySchema.index(
  { seedKey: 1 },
  { unique: true, partialFilterExpression: { seedKey: { $exists: true } } },
);
