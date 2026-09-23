import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { stripEmptyFields } from '../utils/helper.util';
import { ValidationPipeOptions } from '@nestjs/common/pipes/validation.pipe';

@Injectable()
export class ValidatePipe extends ValidationPipe implements PipeTransform<any> {
  constructor(validateOptions?: ValidationPipeOptions) {
    super(validateOptions);
  }

  async transform(value: any, metadata: ArgumentMetadata) {
    if (!!value?.buffer) return value;
    if (value) value = stripEmptyFields(value); // initial clean before validation
    value = await super.transform(value, metadata);
    if (value) value = stripEmptyFields(value); // after validation clean
    return value;
  }
}
