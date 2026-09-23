import { Module } from '@nestjs/common';
import { IsFutureDateConstraint } from './is-future-date.constraint';

@Module({
  providers: [IsFutureDateConstraint],
  exports: [IsFutureDateConstraint],
})
export class ValidationModule {}
