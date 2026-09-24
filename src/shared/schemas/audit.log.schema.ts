import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Model } from 'mongoose';
import { AuditSeverity, AuditType } from '../interfaces';

export type AuditLogDocument = HydratedDocument<AuditLog>;

export type AuditLogModel = Model<AuditLogDocument>;

@Schema({ timestamps: true, minimize: false })
export class AuditLog {
  @Prop({ default: 'UNKNOWN' })
  actionBy: string;

  @Prop({ type: String, enum: AuditType, default: AuditType.USER })
  actionType: AuditType;

  @Prop()
  description: string;

  @Prop({ type: String, enum: AuditSeverity, default: AuditSeverity.INFO })
  severity: AuditSeverity;

  @Prop()
  serviceName: string;

  @Prop()
  requestUrl: string;

  @Prop()
  requestMethod: string;

  @Prop()
  requestModelType: string;

  @Prop()
  requestReference: string;

  @Prop()
  traceId: string;

  @Prop()
  ipAddress: string;

  @Prop()
  requestData: string;

  @Prop()
  responseData: string;

  @Prop()
  responseStatus: number;

  @Prop()
  latencyMs: number;

  @Prop({ default: false })
  actionSuccessful: boolean;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ actionBy: 1, createdAt: -1 });
AuditLogSchema.index({ requestModelType: 1, createdAt: -1 });
AuditLogSchema.index({ requestReference: 1 });
