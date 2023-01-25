import { defineErrors } from '../../support/CustomErrors';

import type { Def as ModelDef } from './types';

const Errors = defineErrors({
  MissingFieldError: 'Expected model "{modelName}" to have field "{fieldName}"',
  DuplicateFieldError: 'Model "{modelName}" has duplicate field "{fieldName}"',
  DuplicateDbKeyError:
    'Models "{modelName}" and "{otherModelName}" have conflicting dbKey "{dbKey}"',
  InvalidModelReferenceError:
    'Model "{modelName}" specifies a relation to non-existent model "{otherModelName}"',
  MissingBackReferenceError:
    'Expected model "{otherModelName}" to have a "{type}" relation to "{modelName}"',
});

export function validateSchema(schema: ObjectOf<ModelDef>) {
  let allDbKeys = new Map<string, string>();
  for (let [modelName, modelDef] of Object.entries(schema)) {
    let { dbKey } = modelDef;
    if (allDbKeys.has(dbKey)) {
      let otherModelName = allDbKeys.get(dbKey) ?? '';
      throw new Errors.DuplicateDbKeyError({
        modelName,
        otherModelName,
        dbKey,
      });
    }
    allDbKeys.set(dbKey, modelName);
    let allFields = new Set(Object.keys(modelDef.fields));
    // Check detachedFields for duplicates
    for (let fieldName of Object.keys(modelDef.detachedFields)) {
      if (allFields.has(fieldName)) {
        throw new Errors.DuplicateFieldError({ modelName, fieldName });
      }
      allFields.add(fieldName);
    }
    // Check each index is a valid field
    for (let fieldName of Object.keys(modelDef.indexes)) {
      if (!hasField(modelDef, fieldName)) {
        throw new Errors.MissingFieldError({ modelName, fieldName });
      }
    }
    // Validate each belongsTo
    for (let [fieldName, otherModelName] of Object.entries(
      modelDef.belongsTo,
    )) {
      if (allFields.has(fieldName)) {
        throw new Errors.DuplicateFieldError({ modelName, fieldName });
      }
      allFields.add(fieldName);
      let otherModelDef = schema[otherModelName];
      if (!otherModelDef || otherModelName === modelName) {
        throw new Errors.InvalidModelReferenceError({
          modelName,
          otherModelName,
        });
      }
      if (
        !hasRelationTo(otherModelDef.hasMany, modelName) &&
        !hasRelationTo(otherModelDef.hasOne, modelName)
      ) {
        throw new Errors.MissingBackReferenceError({
          otherModelName,
          type: 'hasMany or hasOne',
          modelName,
        });
      }
    }
    // Validate each hasOne
    for (let [fieldName, otherModelName] of Object.entries(modelDef.hasOne)) {
      if (allFields.has(fieldName)) {
        throw new Errors.DuplicateFieldError({ modelName, fieldName });
      }
      allFields.add(fieldName);
      let otherModelDef = schema[otherModelName];
      if (!otherModelDef || otherModelName === modelName) {
        throw new Errors.InvalidModelReferenceError({
          modelName,
          otherModelName,
        });
      }
      if (!hasRelationTo(otherModelDef.belongsTo, modelName)) {
        throw new Errors.MissingBackReferenceError({
          otherModelName,
          type: 'belongsTo',
          modelName,
        });
      }
    }
    // Validate each hasMany
    for (let [fieldName, otherModelName] of Object.entries(modelDef.hasMany)) {
      if (allFields.has(fieldName)) {
        throw new Errors.DuplicateFieldError({ modelName, fieldName });
      }
      allFields.add(fieldName);
      let otherModelDef = schema[otherModelName];
      if (!otherModelDef || otherModelName === modelName) {
        throw new Errors.InvalidModelReferenceError({
          modelName,
          otherModelName,
        });
      }
      if (!hasRelationTo(otherModelDef.belongsTo, modelName)) {
        throw new Errors.MissingBackReferenceError({
          otherModelName,
          type: 'belongsTo',
          modelName,
        });
      }
    }
    // Validate each manyToMany
    for (let [fieldName, otherModelName] of Object.entries(
      modelDef.manyToMany,
    )) {
      if (allFields.has(fieldName)) {
        throw new Errors.DuplicateFieldError({ modelName, fieldName });
      }
      allFields.add(fieldName);
      let otherModelDef = schema[otherModelName];
      if (!otherModelDef || otherModelName === modelName) {
        throw new Errors.InvalidModelReferenceError({
          modelName,
          otherModelName,
        });
      }
      if (!hasRelationTo(otherModelDef.manyToMany, modelName)) {
        throw new Errors.MissingBackReferenceError({
          otherModelName,
          type: 'manyToMany',
          modelName,
        });
      }
    }
  }
}

function hasRelationTo(relations: ObjectOf<string>, expectedModelName: string) {
  for (let [_fieldName, modelName] of Object.entries(relations)) {
    if (modelName === expectedModelName) {
      return true;
    }
  }
  return false;
}

function hasField(modelDef: ModelDef, fieldName: string) {
  return modelDef.fields[fieldName] !== undefined;
}
