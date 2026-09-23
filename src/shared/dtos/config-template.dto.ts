import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDefined,
  IsEnum,
  IsNotEmpty,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import {
  ConfigFormTypeEnum,
  ConfigurationFormTypeTemplate,
  ConfigurationValueTemplate,
  ConfigurationValueTypeTemplate,
  ConfigValueTypeEnum,
} from '../interfaces';

export class FormOptionClass {
  @ApiProperty()
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({
    oneOf: [
      { type: 'string' },
      { type: 'number' },
      { type: 'array', items: { type: 'string' } },
      { type: 'array', items: { type: 'number' } },
      { type: 'object' },
      { type: 'array', items: { type: 'object' } },
      { type: 'boolean' },
    ],
  })
  @IsDefined()
  value: ConfigurationValueTemplate;
}

export class FieldConfigClassTemplate {
  @ApiProperty()
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({
    oneOf: [
      { type: 'string' },
      { type: 'number' },
      { type: 'array', items: { type: 'string' } },
      { type: 'array', items: { type: 'number' } },
      { type: 'object' },
      { type: 'array', items: { type: 'object' } },
      { type: 'boolean' },
    ],
  })
  @IsDefined()
  value: ConfigurationValueTemplate;

  @ApiProperty()
  @IsDefined()
  @IsBoolean()
  @IsNotEmpty()
  required: boolean;

  @ApiProperty({
    enum: ConfigValueTypeEnum,
    description: `Values MUST be any of ${Object.values(ConfigValueTypeEnum)}`,
  })
  @IsEnum(ConfigValueTypeEnum)
  @IsDefined()
  @IsNotEmpty()
  valueType: ConfigurationValueTypeTemplate;

  @ApiProperty({
    enum: ConfigFormTypeEnum,
    description: `Values MUST be any of ${Object.values(ConfigFormTypeEnum)}`,
  })
  @IsEnum(ConfigFormTypeEnum)
  @IsDefined()
  @IsNotEmpty()
  formType: ConfigurationFormTypeTemplate;

  @ApiProperty({ type: [FormOptionClass] } as any)
  @ValidateIf((value) => value.formType === 'multi-select')
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => FormOptionClass)
  @IsNotEmpty()
  @ApiPropertyOptional()
  formOptions?: FormOptionClass[];
}
