import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type DataLogDocument = DataLog & Document & any;

@Schema({ timestamps: true })
export class DataLog {
  @Prop({ type: MongooseSchema.Types.Mixed })
  data: object;

  @Prop({ index: true })
  traceId: string;

  @Prop()
  level: string;
}

export const DataLogSchema = SchemaFactory.createForClass(DataLog);
