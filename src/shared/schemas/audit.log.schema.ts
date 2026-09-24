import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Model } from 'mongoose';

import { AuditType } from '../interfaces';

export type AuditLogDocument = HydratedDocument<AuditLog>;

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface AuditLogModel extends Model<AuditLogDocument> {}

@Schema({ timestamps: true, minimize: false })
export class AuditLog {
  @Prop()
  actionBy: string;

  @Prop()
  actionType: AuditType;

  @Prop({ default: 'YAHHEL_PAGER' })
  serviceName: string;

  @Prop({ default: 'UNKNOWN' })
  action: string;

  @Prop()
  description: string;

  @Prop()
  actionSuccessful: boolean;

  @Prop()
  latencyMs: number;

  @Prop()
  responseStatus: number;

  @Prop()
  requestUrl: string;

  @Prop()
  requestMethod: string;

  @Prop()
  requestActionBy: string;

  @Prop()
  requestModelType: string;

  @Prop({ default: 'UNKNOWN' })
  severity: string;

  @Prop()
  requestReference: string;

  @Prop()
  ipAddress: string;

  @Prop({ type: String })
  requestData: string;

  @Prop({ type: String })
  responseData: string;

  declare createdAt: Date;
  declare updatedAt: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ actionBy: 1, createdAt: -1 });
AuditLogSchema.index({ requestModelType: 1, createdAt: -1 });
AuditLogSchema.index({ requestReference: 1 });
