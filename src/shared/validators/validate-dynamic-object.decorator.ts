import { Transform } from 'class-transformer';
import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  validateSync,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { plainToInstance } from 'class-transformer';

export interface ValidateDynamicObjectOptions {
  allowNull?: boolean;
  allowUndefined?: boolean;
}

export function ValidateDynamicObject(
  dtoClass: any,
  options: ValidateDynamicObjectOptions = {},
  validationOptions?: ValidationOptions,
) {
  const { allowNull = true, allowUndefined = true } = options;

  return function (target: object, propertyName: string) {
    // Apply Transform decorator to preserve the object structure
    Transform(
      ({ value }) => {
        // Preserve undefined/null at the property level
        if (value === undefined || value === null) {
          return value;
        }

        // Ensure we're working with an object
        if (typeof value !== 'object' || Array.isArray(value)) {
          return value;
        }

        // Transform each value in the dynamic object
        const transformed: Record<string, any> = {};
        for (const [key, val] of Object.entries(value)) {
          if (val === null) {
            transformed[key] = null;
          } else if (val !== undefined && typeof val === 'object') {
            // Transform to class instance for validation
            transformed[key] = plainToInstance(dtoClass, val);
          } else {
            transformed[key] = val;
          }
        }

        return transformed;
      },
      { toClassOnly: true },
    )(target, propertyName);

    // Apply custom validator
    registerDecorator({
      name: 'validateDynamicObject',
      target: target.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [dtoClass, allowNull, allowUndefined],
      validator: DynamicObjectValidator,
    });
  };
}

@ValidatorConstraint({ name: 'validateDynamicObject', async: false })
class DynamicObjectValidator implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const [, allowNull, allowUndefined] = args.constraints;

    // Handle undefined/null at property level
    if (value === undefined) {
      return allowUndefined;
    }

    if (value === null) {
      return allowNull;
    }

    // Must be an object
    if (typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    // Validate each value in the dynamic object
    for (const val of Object.values(value)) {
      // Allow null values for deletion
      if (val === null) {
        if (!allowNull) {
          return false;
        }
        continue;
      }

      // Allow undefined values
      if (val === undefined) {
        if (!allowUndefined) {
          return false;
        }
        continue;
      }

      // Validate against the DTO class
      const errors = validateSync(val as object, {
        whitelist: true,
        forbidNonWhitelisted: false,
      });

      if (errors.length > 0) {
        return false;
      }
    }

    return true;
  }

  defaultMessage(args: ValidationArguments) {
    const [dtoClass] = args.constraints;
    const className = dtoClass.name || 'specified class';
    return `Each value in ${args.property} must be a valid ${className} instance or null`;
  }
}
