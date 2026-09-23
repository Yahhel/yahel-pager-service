import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  registerDecorator,
  ValidationOptions,
  isDateString,
} from 'class-validator';
import { isAfter } from 'date-fns';

@ValidatorConstraint({ name: 'isFutureDate', async: false })
export class IsFutureDateConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    if (!isDateString(value)) return false;
    return isAfter(new Date(value), new Date());
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} must be a future date.`;
  }
}

export const IsFutureDate = (validationOptions?: ValidationOptions) => {
  return function (object: Record<string, any>, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsFutureDateConstraint,
    });
  };
};
