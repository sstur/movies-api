/* eslint-disable @typescript-eslint/no-explicit-any */
import util from 'util';

import type { Failure, Record, Runtype, Static } from 'runtypes';

import { getStore } from '../../db/store';
import { createId } from '../../support/createId';
import { isObject } from '../../support/isObject';
import type { Transaction } from '../../db/transactions';

import { Errors } from './Errors';
import { now } from './dateTime';
import { ConnectById, validatorsForSchema } from './validation';
import type { Def as ModelDef, Model, Options, UpdatableFields } from './types';
import { validateSchema } from './validateSchema';

type GetOpts = {
  include: { [key: string]: true };
};

type SchemaDeep<T extends string> = {
  [K in T]: ModelDeep<T, K>;
};

type ModelDeep<T extends string, K extends T> = {
  name: K;
  schema: SchemaDeep<T>;
  dbKey: string;
  fields: ObjectOf<Runtype>;
  detachedFields: ObjectOf<Runtype>;
  indexes: ObjectOf<true>;
  belongsTo: ObjectOf<T>;
  hasMany: ObjectOf<T>;
  hasOne: ObjectOf<T>;
  manyToMany: ObjectOf<T>;
  options: Options;
};

// TODO: Better name?
type Models<S extends ObjectOf<ModelDef>> = { [K in keyof S]: Model<S, S[K]> };

type StaticMethods<S extends ObjectOf<ModelDef>> = {
  $txn: <T>(
    procedure: (db: Models<S> & { $: Transaction }) => Promise<T>,
  ) => Promise<T>;
};

export function defineSchema<S extends ObjectOf<ModelDef>>(
  schemaDef: S,
): Expand<Models<S> & StaticMethods<S>> {
  validateSchema(schemaDef);
  // Here we make a copy of the schemaDef in which each modelDef contains both a
  // name property and a back-reference to this new schema object.
  let schema = {} as ObjectOf<ModelDeep<string, string>>;
  for (let [modelName, modelDef] of Object.entries(schemaDef)) {
    schema[modelName] = {
      ...modelDef,
      name: modelName,
      schema: schema,
    } as any;
  }
  return {
    ...Object.fromEntries(
      Object.entries(schema).map(([modelName, modelDef]) => {
        return [modelName, createModel(modelDef)];
      }),
    ),
    $txn: async <T>(procedure: (txn: Models<S>) => Promise<T>): Promise<T> => {
      let store = getStore();
      return await store.transaction.exec(async (txn) => {
        let db = {
          $: txn,
          ...Object.fromEntries(
            Object.entries(schema).map(([modelName, modelDef]) => {
              return [modelName, createModel(modelDef, txn)];
            }),
          ),
        };
        return await procedure(db as any);
      });
    },
  } as any;
}

function createModel<D extends ModelDeep<string, string>>(
  modelDef: D,
  txn?: Transaction,
): unknown {
  return {
    create: async (input: ObjectOf<unknown>) => {
      return await exec(txn, async (txn) => {
        let { create } = getHelpers(txn);
        return await create(modelDef, input);
      });
    },
    // The `getList()` method for top-level entities, that is those that do not
    // have a `belongsTo` relationship with any other entity
    getList: async () => {
      return await exec(txn, async (txn) => {
        let idList = await txn.get(modelDef.dbKey);
        if (Array.isArray(idList)) {
          return idList.filter((id) => typeof id === 'string');
        }
        return [];
      });
    },
    // Add chaining methods; e.g. `user.byId().profile.get()`
    byId: (id: string) => {
      return getChainingMethods(modelDef, async () => id, txn);
    },
    ...Object.fromEntries(
      Object.entries(modelDef.indexes).map(([fieldName]) => [
        `by${capitalize(fieldName)}`,
        (value: string) => {
          return getChainingMethods(
            modelDef,
            async (txn) => {
              let id = await txn.get(
                resolveIndexKey(modelDef, fieldName, value),
              );
              return typeof id === 'string' ? id : undefined;
            },
            txn,
          );
        },
      ]),
    ),
  } as any;
}

async function exec<T>(
  txn: Transaction | undefined,
  procedure: (txn: Transaction) => Promise<T>,
): Promise<T> {
  if (txn) {
    return await procedure(txn);
  } else {
    let store = getStore();
    return await store.transaction.exec(procedure);
  }
}

function getChainingMethods<D extends ModelDeep<string, string>>(
  modelDef: D,
  getId: (txn: Transaction) => Promise<string | undefined>,
  txn: Transaction | undefined,
) {
  let hasOneRelations = { ...modelDef.belongsTo, ...modelDef.hasOne };
  let getHasManyGetterMethods = (fieldName: string, otherModelName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    let otherModelDef = modelDef.schema[otherModelName]!;
    let getList = async (txn: Transaction) => {
      let id = await getId(txn);
      if (id != null) {
        // Here we're effectively checking if a record with this ID exists. This
        // probably shouldn't necessary because every valid record should have
        // the corresponding field key, but I'm not confident that will be the
        // case in reality.
        let recordExists = await txn.has(resolveKey(modelDef, id));
        if (!recordExists) {
          return;
        }
        let idList = await txn.get(resolveFieldKey(modelDef, id, fieldName));
        if (Array.isArray(idList)) {
          return idList.filter((id) => typeof id === 'string') as Array<string>;
        }
        return [];
      }
    };
    return {
      getList: async () => {
        return await exec(txn, async (txn) => {
          return await getList(txn);
        });
      },
      getAll: async (options?: GetOpts) => {
        return await exec(txn, async (txn) => {
          let { getById } = getHelpers(txn);
          let list = await getList(txn);
          if (Array.isArray(list)) {
            let results = [];
            for (let id of list) {
              let result = await getById(otherModelDef, id, options);
              if (result) {
                results.push(result);
              }
            }
            return results;
          }
        });
      },
      // Add chaining methods; e.g. `byId().tags.getAll()`
      byId: (id: string) => {
        return getChainingMethods(
          otherModelDef,
          async (txn) => {
            let allowedList = await getList(txn);
            return allowedList?.includes(id) ? id : undefined;
          },
          txn,
        );
      },
      ...Object.fromEntries(
        Object.entries(otherModelDef.indexes).map(([fieldName]) => [
          `by${capitalize(fieldName)}`,
          (value: string) => {
            return getChainingMethods(
              otherModelDef,
              async (txn) => {
                let id = await txn.get(
                  resolveIndexKey(otherModelDef, fieldName, value),
                );
                if (typeof id === 'string') {
                  let allowedList = await getList(txn);
                  return allowedList?.includes(id) ? id : undefined;
                }
              },
              txn,
            );
          },
        ]),
      ),
    };
  };
  return {
    get: async (options?: GetOpts) => {
      return await exec(txn, async (txn) => {
        let { getById } = getHelpers(txn);
        let id = await getId(txn);
        if (id) {
          return await getById(modelDef, id, options);
        }
      });
    },
    update: async (input: Partial<UpdatableFields<D>>) => {
      return await exec(txn, async (txn) => {
        let validators = validatorsForSchema(modelDef.schema);
        let UpdateInputRuntype = validators.getUpdateInputRuntype(modelDef);
        let normalized = normalizeInput(UpdateInputRuntype, input);
        let data = validate(UpdateInputRuntype, normalized);
        if (!data) {
          // TODO: Include details of why validation failed.
          throw new Errors.InvalidInputError();
        }
        let id = await getId(txn);
        let fromDb = id ? await txn.get(resolveKey(modelDef, id)) : undefined;
        if (!id || !isObject(fromDb)) {
          return;
        }
        // Detached fields
        for (let fieldName of Object.keys(modelDef.detachedFields)) {
          if (data.hasOwnProperty(fieldName)) {
            let value = data[fieldName as never];
            delete data[fieldName as never];
            txn.put(resolveFieldKey(modelDef, id, fieldName), value);
          }
        }
        let fullRecord = {
          ...fromDb,
          ...data,
          updatedAt: now(),
        };
        // Check uniqueness and update indexes
        for (let fieldName of Object.keys(modelDef.indexes)) {
          let oldValue = String(fromDb[fieldName]);
          let value = String(fullRecord[fieldName as never]);
          if (value !== oldValue) {
            let exists = await txn.has(
              resolveIndexKey(modelDef, fieldName, value),
            );
            if (exists) {
              throw new Errors.UniqueConstraintViolationError({ fieldName });
            }
            txn.del(resolveIndexKey(modelDef, fieldName, oldValue));
            txn.put(resolveIndexKey(modelDef, fieldName, value), id);
          }
        }
        txn.put(resolveKey(modelDef, id), fullRecord);
        return fullRecord;
      });
    },
    delete: async () => {
      return await exec(txn, async (txn) => {
        let { deleteById } = getHelpers(txn);
        let id = await getId(txn);
        if (id) {
          await deleteById(modelDef, id);
        }
      });
    },
    // The getter methods for detachedFields such as account.byId().settings.get()
    ...Object.fromEntries(
      Object.entries(modelDef.detachedFields).map(([fieldName, _Schema]) => [
        fieldName,
        {
          get: async () => {
            return await exec(txn, async (txn) => {
              let id = await getId(txn);
              if (id != null) {
                let value = await txn.get(
                  resolveFieldKey(modelDef, id, fieldName),
                );
                // TODO: Validate?
                return value;
              }
            });
          },
        },
      ]),
    ),
    // The getter methods for hasOne and belongsTo such as db.user.byId().account.get()
    ...Object.fromEntries(
      Object.entries(hasOneRelations).map(([fieldName, otherModelName]) => [
        fieldName,
        {
          get: async (options?: GetOpts) => {
            return await exec(txn, async (txn) => {
              let { getById } = getHelpers(txn);
              let otherModelDef = modelDef.schema[otherModelName];
              if (otherModelDef) {
                let id = await getId(txn);
                if (id != null) {
                  let fromDb = await txn.get(resolveKey(modelDef, id));
                  if (isObject(fromDb)) {
                    let otherId = fromDb[fieldName];
                    if (typeof otherId === 'string') {
                      return await getById(otherModelDef, otherId, options);
                    }
                  }
                }
              }
            });
          },
        },
      ]),
    ),
    // The nested methods for hasMany such as db.account.byId().users.getList()
    ...Object.fromEntries(
      Object.entries(modelDef.hasMany).map(([fieldName, otherModelName]) => {
        return [fieldName, getHasManyGetterMethods(fieldName, otherModelName)];
      }),
    ),
    // The nested methods for manyToMany such as db.account.byId().users.getList()
    ...Object.fromEntries(
      Object.entries(modelDef.manyToMany).map(([fieldName, otherModelName]) => {
        return [
          fieldName,
          {
            ...getHasManyGetterMethods(fieldName, otherModelName),
            // The add method such as db.user.byId().tags.add(idList)
            add: async (idList: Array<string>) => {
              return await exec(txn, async (txn) => {
                let { updateChildList, bumpUpdatedAt } = getHelpers(txn);
                let otherModelDef = modelDef.schema[otherModelName];
                if (otherModelDef) {
                  let id = await getId(txn);
                  if (id != null) {
                    let listFromDb = await txn.get(
                      resolveFieldKey(modelDef, id, fieldName),
                    );
                    let fullList = new Set(
                      Array.isArray(listFromDb) ? listFromDb : [],
                    );
                    for (let otherId of idList) {
                      if (!fullList.has(otherId)) {
                        fullList.add(otherId);
                        let otherRecordExists = await txn.has(
                          resolveKey(otherModelDef, otherId),
                        );
                        if (!otherRecordExists) {
                          throw new Errors.InvalidForeignReferenceError({
                            modelName: otherModelName,
                            id: otherId,
                          });
                        }
                        await updateChildList(
                          modelDef.name,
                          otherModelDef,
                          otherId,
                          (existingList) => [...existingList, id],
                        );
                      }
                    }
                    txn.put(resolveFieldKey(modelDef, id, fieldName), [
                      ...fullList,
                    ]);
                    await bumpUpdatedAt(modelDef, id);
                  }
                }
              });
            },
            // The remove method such as db.user.byId().tags.remove(idList)
            remove: async (idList: Array<string>) => {
              return await exec(txn, async (txn) => {
                let { updateChildList, bumpUpdatedAt } = getHelpers(txn);
                let otherModelDef = modelDef.schema[otherModelName];
                if (otherModelDef) {
                  let id = await getId(txn);
                  if (id != null) {
                    let listFromDb = await txn.get(
                      resolveFieldKey(modelDef, id, fieldName),
                    );
                    let fullList = new Set(
                      Array.isArray(listFromDb) ? listFromDb : [],
                    );
                    for (let otherId of idList) {
                      if (fullList.has(otherId)) {
                        fullList.delete(otherId);
                        await updateChildList(
                          modelDef.name,
                          otherModelDef,
                          otherId,
                          (existingList) =>
                            existingList.filter((childId) => childId !== id),
                        );
                      }
                    }
                    txn.put(resolveFieldKey(modelDef, id, fieldName), [
                      ...fullList,
                    ]);
                    await bumpUpdatedAt(modelDef, id);
                  }
                }
              });
            },
          },
        ];
      }),
    ),
  };
}

function getHelpers(txn: Transaction) {
  const create = async <D extends ModelDeep<string, string>>(
    modelDef: D,
    input: ObjectOf<unknown>,
  ) => {
    let validators = validatorsForSchema(modelDef.schema);
    let CreateInputRuntype = validators.getCreateInputRuntype(modelDef);
    let normalized = normalizeInput(CreateInputRuntype, input);
    let data = validate(CreateInputRuntype, normalized);
    if (!data) {
      // TODO: Include details of why validation failed.
      throw new Errors.InvalidInputError();
    }
    let id = await createId();
    let timestamp = now();
    let fullRecord = {
      id,
      ...data,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    let returnRecord: ObjectOf<unknown> = { ...fullRecord };
    // Detached fields
    for (let fieldName of Object.keys(modelDef.detachedFields)) {
      let value = fullRecord[fieldName as never];
      // Delete field since its value will be stored in a detached field
      delete fullRecord[fieldName as never];
      txn.put(resolveFieldKey(modelDef, id, fieldName), value);
    }
    // Validate belongsTo and update parent in case of hasOne
    for (let [fieldName, otherModelName] of Object.entries(
      modelDef.belongsTo,
    )) {
      let otherModelDef = modelDef.schema[otherModelName];
      if (!otherModelDef) {
        continue;
      }
      let otherId = String(fullRecord[fieldName as never]);
      let otherRecord = await txn.get(resolveKey(otherModelDef, otherId));
      if (!isObject(otherRecord)) {
        throw new Errors.InvalidForeignKeyError({ fieldName });
      }
      let otherModelHasOne = getFieldReferringToModel(
        otherModelDef.hasOne,
        modelDef.name,
      );
      if (otherModelHasOne) {
        let fieldName = otherModelHasOne;
        if (otherRecord[fieldName]) {
          throw new Errors.HasOneUniquenessViolationError({
            otherModelName,
            modelName: modelDef.name,
          });
        }
        otherRecord[fieldName] = id;
        txn.put(resolveKey(otherModelDef, otherId), otherRecord);
      }
    }
    // If this is a top-level entity, update the list of IDs
    if (Object.entries(modelDef.belongsTo).length === 0) {
      let idList = await txn.get(modelDef.dbKey);
      let newList = Array.isArray(idList) ? [...idList, id] : [id];
      txn.put(modelDef.dbKey, newList);
    }
    // Validate and write manyToMany relationships
    for (let [fieldName, otherModelName] of Object.entries(
      modelDef.manyToMany,
    )) {
      let otherModelDef = modelDef.schema[otherModelName];
      if (!otherModelDef) {
        continue;
      }
      let providedValue = fullRecord[fieldName as never];
      // Delete field since this list will be stored in a detached field
      delete fullRecord[fieldName as never];
      delete returnRecord[fieldName as never];
      let list: Array<unknown> = Array.isArray(providedValue)
        ? providedValue
        : [];
      let idList: Array<string> = [];
      for (let item of list) {
        if (ConnectById.guard(item)) {
          let otherId = item.connect;
          idList.push(otherId);
          let exists = await txn.has(resolveKey(otherModelDef, otherId));
          if (!exists) {
            throw new Errors.InvalidForeignKeyError({ fieldName });
          }
          // Update the record on the other side of the relation
          await updateChildList(
            modelDef.name,
            otherModelDef,
            otherId,
            (existingList) => [...existingList, id],
          );
        }
      }
      txn.put(resolveFieldKey(modelDef, id, fieldName), idList);
    }
    // Check uniqueness and update indexes
    for (let fieldName of Object.keys(modelDef.indexes)) {
      let value = String(fullRecord[fieldName as never]);
      let exists = await txn.has(resolveIndexKey(modelDef, fieldName, value));
      if (exists) {
        throw new Errors.UniqueConstraintViolationError({ fieldName });
      }
      txn.put(resolveIndexKey(modelDef, fieldName, value), id);
    }
    // Add Null fields for each hasOne relationship
    for (let [fieldName] of Object.entries(modelDef.hasOne)) {
      fullRecord[fieldName as never] = null as never;
    }
    txn.put(resolveKey(modelDef, id), fullRecord);
    await updateOneToManyParents(modelDef, fullRecord, (existingList) => {
      return [...existingList, id];
    });
    // Handle nested creates for hasOne
    // Note: For each child created here the record we just put above will be
    // read and written again in order to update the hasOne field, which I guess
    // is OK since we're doing this all in memory as part of a transaction.
    for (let [fieldName, otherModelName] of Object.entries(modelDef.hasOne)) {
      let created;
      let nestedCreate = input[fieldName];
      if (isObject(nestedCreate)) {
        let otherModelDef = modelDef.schema[otherModelName];
        if (otherModelDef) {
          let otherModelFieldName = getFieldReferringToModel(
            otherModelDef.belongsTo,
            modelDef.name,
          );
          if (otherModelFieldName) {
            let createInput = { [otherModelFieldName]: id, ...nestedCreate };
            created = await create(otherModelDef, createInput);
          }
        }
      }
      returnRecord[fieldName] = created ?? null;
    }
    // Handle nested creates for hasMany
    for (let [fieldName, otherModelName] of Object.entries(modelDef.hasMany)) {
      let createdList = [];
      let nestedCreate = input[fieldName];
      if (Array.isArray(nestedCreate)) {
        let otherModelDef = modelDef.schema[otherModelName];
        if (otherModelDef) {
          let otherModelFieldName = getFieldReferringToModel(
            otherModelDef.belongsTo,
            modelDef.name,
          );
          if (otherModelFieldName) {
            for (let item of nestedCreate) {
              if (isObject(item)) {
                let createInput = { [otherModelFieldName]: id, ...item };
                let created = await create(otherModelDef, createInput);
                createdList.push(created);
              }
            }
          }
        }
      }
      returnRecord[fieldName] = createdList;
    }
    return returnRecord;
  };

  const getById = async <D extends ModelDeep<string, string>>(
    modelDef: D,
    id: string,
    options?: GetOpts,
  ) => {
    let fromDb = await txn.get(resolveKey(modelDef, id));
    if (!isObject(fromDb)) {
      return;
    }
    let validators = validatorsForSchema(modelDef.schema);
    let FullRecordRuntype = validators.getFullRecordRuntype(modelDef);
    // TODO: Should we move this logic into store.get()?
    validate(FullRecordRuntype, fromDb, (failure) => {
      let key = resolveKey(modelDef, id);
      let details = util.inspect(failure.details);
      let error = new Errors.InternalDataFailedValidationError({
        key,
        details,
      });
      // In dev/prod we won't throw on validation failure, instead we'll log the
      // failure and continue. This might change in the future.
      if (process.env.NODE_ENV === 'test') {
        throw error;
      } else {
        // TODO: Let's log this to somewhere other than the console.
        // eslint-disable-next-line no-console
        console.error(error);
      }
    });
    if (options?.include) {
      return await includeChildren(modelDef, id, fromDb, options.include);
    } else {
      return fromDb;
    }
  };

  const deleteById = async <D extends ModelDeep<string, string>>(
    modelDef: D,
    id: string,
  ) => {
    let fromDb = await txn.get(resolveKey(modelDef, id));
    if (!isObject(fromDb)) {
      return;
    }
    // Remove children (hasMany)
    for (let [fieldName, otherModelName] of Object.entries(modelDef.hasMany)) {
      let otherModelDef = modelDef.schema[otherModelName];
      if (!otherModelDef) {
        continue;
      }
      let childListKey = resolveFieldKey(modelDef, id, fieldName);
      let idList = await txn.get(childListKey);
      if (Array.isArray(idList)) {
        for (let id of idList) {
          await deleteById(otherModelDef, String(id));
        }
      }
      txn.del(childListKey);
    }
    // Remove children (hasOne)
    for (let [fieldName, otherModelName] of Object.entries(modelDef.hasOne)) {
      let otherModelDef = modelDef.schema[otherModelName];
      if (otherModelDef) {
        let childId = fromDb[fieldName];
        if (typeof childId === 'string') {
          await deleteById(otherModelDef, childId);
        }
      }
    }
    // Remove from any parent that has a one:one with this one
    for (let [fieldName, otherModelName] of Object.entries(
      modelDef.belongsTo,
    )) {
      let otherModelDef = modelDef.schema[otherModelName];
      if (otherModelDef) {
        let otherId = String(fromDb[fieldName as never]);
        let otherRecord = await txn.get(resolveKey(otherModelDef, otherId));
        if (isObject(otherRecord)) {
          let otherModelHasOne = getFieldReferringToModel(
            otherModelDef.hasOne,
            modelDef.name,
          );
          if (otherModelHasOne) {
            let fieldName = otherModelHasOne;
            otherRecord[fieldName] = null;
            txn.put(resolveKey(otherModelDef, otherId), otherRecord);
          }
        }
      }
    }
    // Remove from any parent that has a one:many with this one
    await updateOneToManyParents(modelDef, fromDb, (existingList) => {
      return existingList.filter((childId) => childId !== id);
    });
    // Remove from any parent that has a many:many with this one
    for (let [fieldName, otherModelName] of Object.entries(
      modelDef.manyToMany,
    )) {
      let otherModelDef = modelDef.schema[otherModelName];
      let idList = await txn.get(resolveFieldKey(modelDef, id, fieldName));
      if (otherModelDef && Array.isArray(idList)) {
        for (let otherId of idList) {
          await updateChildList(
            modelDef.name,
            otherModelDef,
            String(otherId),
            (existingList) => existingList.filter((childId) => childId !== id),
          );
        }
      }
      txn.del(resolveFieldKey(modelDef, id, fieldName));
    }
    // Remove from the list of IDs if this is a top-level entity
    if (Object.entries(modelDef.belongsTo).length === 0) {
      let idList = await txn.get(modelDef.dbKey);
      if (Array.isArray(idList)) {
        let newList = idList.filter((otherId) => otherId !== id);
        txn.put(modelDef.dbKey, newList);
      }
    }
    // Update indexes
    for (let fieldName of Object.keys(modelDef.indexes)) {
      let value = String(fromDb[fieldName]);
      txn.del(resolveIndexKey(modelDef, fieldName, value));
    }
    // Remove detached fields
    for (let fieldName of Object.keys(modelDef.detachedFields)) {
      txn.del(resolveFieldKey(modelDef, id, fieldName));
    }
    txn.del(resolveKey(modelDef, id));
  };

  const includeChildren = async <D extends ModelDeep<string, string>>(
    modelDef: D,
    id: string,
    data: ObjectOf<unknown>,
    include: ObjectOf<true>,
  ) => {
    for (let [fieldName, _Schema] of Object.entries(modelDef.detachedFields)) {
      if (include[fieldName]) {
        let value = await txn.get(resolveFieldKey(modelDef, id, fieldName));
        // TODO: Validate?
        data[fieldName] = value;
      }
    }
    for (let [fieldName, otherModelName] of Object.entries(
      modelDef.belongsTo,
    )) {
      if (include[fieldName]) {
        let otherModelDef = modelDef.schema[otherModelName];
        if (otherModelDef) {
          let id = String(data[fieldName]);
          data[fieldName] = await getById(otherModelDef, id);
        }
      }
    }
    for (let [fieldName, otherModelName] of Object.entries(modelDef.hasOne)) {
      if (include[fieldName]) {
        let otherModelDef = modelDef.schema[otherModelName];
        if (otherModelDef) {
          let id = data[fieldName];
          if (typeof id === 'string') {
            data[fieldName] = await getById(otherModelDef, id);
          } else {
            data[fieldName] = null;
          }
        }
      }
    }
    let relations = { ...modelDef.hasMany, ...modelDef.manyToMany };
    for (let [fieldName, otherModelName] of Object.entries(relations)) {
      if (include[fieldName]) {
        let otherModelDef = modelDef.schema[otherModelName];
        if (otherModelDef) {
          let children = await rehydrateChildren(
            modelDef,
            id,
            fieldName,
            otherModelDef,
          );
          data[fieldName] = children || [];
        }
      }
    }
    return data;
  };

  const rehydrateChildren = async <
    D extends ModelDeep<string, string>,
    E extends ModelDeep<string, string>,
  >(
    modelDef: D,
    id: string,
    fieldName: string,
    otherModelDef: E,
  ) => {
    let idList = await txn.get(resolveFieldKey(modelDef, id, fieldName));
    if (!Array.isArray(idList)) {
      return;
    }
    let results: Array<unknown> = [];
    for (let id of idList) {
      let result = await getById(otherModelDef, String(id));
      if (result) {
        results.push(result);
      }
    }
    return results;
  };

  const updateChildList = async (
    childModelName: string,
    parentModelDef: ModelDeep<string, string>,
    parentId: string,
    getNewList: (oldList: Array<unknown>) => Array<unknown>,
  ) => {
    let { hasMany, manyToMany } = parentModelDef;
    let relations = { ...hasMany, ...manyToMany };
    let childListFieldName = getFieldReferringToModel(
      relations,
      childModelName,
    );
    if (!childListFieldName) {
      return;
    }
    let parentFieldKey = resolveFieldKey(
      parentModelDef,
      parentId,
      childListFieldName,
    );
    let existingList = await txn.get(parentFieldKey);
    let newList = getNewList(Array.isArray(existingList) ? existingList : []);
    txn.put(parentFieldKey, newList);
    await bumpUpdatedAt(parentModelDef, parentId);
  };

  const updateOneToManyParents = async (
    modelDef: ModelDeep<string, string>,
    fullRecord: ObjectOf<unknown>,
    getNewList: (oldList: Array<unknown>) => Array<unknown>,
  ) => {
    for (let [fieldName, parentModelName] of Object.entries(
      modelDef.belongsTo,
    )) {
      let parentModelDef = modelDef.schema[parentModelName];
      if (parentModelDef) {
        let parentId = String(fullRecord[fieldName as never]);
        await updateChildList(
          modelDef.name,
          parentModelDef,
          parentId,
          getNewList,
        );
      }
    }
  };

  const bumpUpdatedAt = async (
    modelDef: ModelDeep<string, string>,
    id: string,
  ) => {
    let key = resolveKey(modelDef, id);
    let record = await txn.get(key);
    if (isObject(record)) {
      txn.put(key, { ...record, updatedAt: now() });
    }
  };

  return {
    create,
    getById,
    deleteById,
    updateChildList,
    bumpUpdatedAt,
  };
}

function getFieldReferringToModel(
  fieldNameToModelName: ObjectOf<string>,
  targetModelName: string,
) {
  for (let [fieldName, modelName] of Object.entries(fieldNameToModelName)) {
    if (modelName === targetModelName) {
      return fieldName;
    }
  }
}

function resolveKey<D extends ModelDeep<string, string>>(
  modelDef: D,
  id: string,
): string {
  return `${modelDef.dbKey}/${id}`;
}

// In certain cases we're putting a field in a separate DB record.
function resolveFieldKey<D extends ModelDeep<string, string>>(
  modelDef: D,
  id: string,
  fieldName: string,
): string {
  return `${modelDef.dbKey}/${id}/${fieldName}`;
}

function resolveIndexKey<D extends ModelDeep<string, string>>(
  modelDef: D,
  fieldName: string,
  value: string,
): string {
  return `indexes/${modelDef.dbKey}/${fieldName}/${value.toLowerCase()}`;
}

function capitalize(input: string): string {
  return input.charAt(0).toUpperCase() + input.slice(1);
}

function validate<T extends Runtype>(
  schema: T,
  data: unknown,
  onValidationError?: (error: Failure) => void,
): Static<T> | undefined {
  if (data != null) {
    let result = schema.validate(data);
    if (result.success) {
      return result.value;
    } else {
      onValidationError?.(result);
    }
  }
}

function normalizeInput(schema: Record<any, false>, data: ObjectOf<unknown>) {
  let output: ObjectOf<unknown> = {};
  for (let [key, value] of Object.entries(data)) {
    if (schema.fields.hasOwnProperty(key)) {
      output[key] = value;
    }
  }
  return output;
}
