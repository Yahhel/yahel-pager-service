import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import {
  ProductStatusEnum,
  ProductTypeEnum,
  ProductCategoryEnum,
  MetaDetails,
  MetaDetailsRaw,
} from '../interfaces';

export type ProductDocument = Product & Document & any;

@Schema({ timestamps: true })
export class Product {
  @Prop({ index: true, required: true })
  amount: number;

  @Prop({ index: true, required: true, unique: true })
  reference: string;

  @Prop({ index: true, required: true, unique: true })
  provider_reference: string;

  @Prop({ required: true })
  category: ProductCategoryEnum;

  @Prop({ index: true, required: true })
  status: ProductStatusEnum;

  @Prop({ required: true })
  type: ProductTypeEnum;

  @Prop()
  description: string;

  @Prop()
  wallet: string;

  @Prop()
  business: string;

  @Prop()
  user: string;

  @Prop()
  tenant: string;

  @Prop({ required: true })
  countryCode: string;

  @Prop(raw(MetaDetailsRaw))
  meta: MetaDetails;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
