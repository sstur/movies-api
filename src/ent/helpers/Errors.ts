import { defineErrors } from '../../support/CustomErrors';

export const Errors = defineErrors({
  InvalidInputError: 'Input did not pass validation',
  InvalidForeignKeyError:
    'Invalid foreign key specified at field "{fieldName}"',
  InvalidForeignReferenceError:
    'No record exists on model "{modelName}" with ID "{id}"',
  UniqueConstraintViolationError:
    'Unique constraint violation for field "{fieldName}"',
  HasOneUniquenessViolationError:
    'Operation would overwrite hasOne reference; Record of type "{otherModelName}" has an existing reference to "{modelName}"',
  InternalDataFailedValidationError:
    'Record at key "{key}" did not pass validation: {details}',
});
