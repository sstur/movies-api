import { Array, Null, Record, String, type Runtype } from 'runtypes';

import type {
  CreatableFieldsSimple,
  Def as ModelDef,
  FullRecord,
  UpdatableFields,
} from './types';

export const ConnectById = Record({ connect: String });

export const validatorsForSchema = memoize((_schemaDef: ObjectOf<ModelDef>) => {
  // This describes the full record as it's stored in the database.
  const getFullRecordRuntype = <D extends ModelDef>(
    modelDef: D,
  ): Record<FullRecord<D>, false> => {
    let { fields, belongsTo, hasOne } = modelDef;
    let { id, ...otherFields } = fields;
    return Record({
      id: String,
      ...otherFields,
      ...Object.fromEntries(
        Object.entries(belongsTo).map(([key]) => [key, String]),
      ),
      ...Object.fromEntries(
        Object.entries(hasOne).map(([key]) => [key, String.Or(Null)]),
      ),
      createdAt: String,
      updatedAt: String,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;
  };

  const getCreateInputRuntype = <D extends ModelDef>(
    modelDef: D,
  ): Record<CreatableFieldsSimple<D>, false> => {
    let { fields, detachedFields, belongsTo, manyToMany } = modelDef;
    let { id, ...otherFields } = fields;
    return Record({
      ...otherFields,
      ...detachedFields,
      ...Object.fromEntries(
        Object.entries(belongsTo).map(([key]) => [key, String]),
      ),
      ...Object.fromEntries(
        Object.entries(manyToMany).map(([key]) => [
          key,
          Array(ConnectById).optional(),
        ]),
      ),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;
  };

  const getUpdateInputRuntype = <D extends ModelDef>(
    modelDef: D,
  ): Record<UpdatableFields<D>, false> => {
    let { id, ...otherFields } = modelDef.fields;
    return Record({
      ...Object.fromEntries(
        Object.entries(modelDef.detachedFields).map(([key, Type]) => [
          key,
          isOptional(Type) ? Type : Type.optional(),
        ]),
      ),
      ...Object.fromEntries(
        Object.entries(otherFields).map(([key, Type]) => [
          key,
          isOptional(Type) ? Type : Type.optional(),
        ]),
      ),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;
  };

  return {
    getFullRecordRuntype: memoize(getFullRecordRuntype),
    getCreateInputRuntype: memoize(getCreateInputRuntype),
    getUpdateInputRuntype: memoize(getUpdateInputRuntype),
  };
});

// Simple memoization for a function which takes a single, stable arg
function memoize<Arg, Ret>(fn: (arg: Arg) => Ret): (arg: Arg) => Ret {
  let cache = new Map<Arg, Ret>();
  return (arg: Arg) => cache.get(arg) || set(cache, arg, fn(arg));
}

// Set a value on a Map and return that value
function set<K, V>(map: Map<K, V>, key: K, val: V): V {
  map.set(key, val);
  return val;
}

function isOptional(Type: Runtype<unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (Type as any).tag === 'optional';
}
