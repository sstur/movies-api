import type { Runtype, Static } from 'runtypes';

export type Options = {
  idType?: 'hex' | 'short';
};

export type DefInput = {
  dbKey: string;
  fields: ObjectOf<Runtype>;
  detachedFields?: ObjectOf<Runtype>;
  indexes?: ObjectOf<true>;
  belongsTo?: ObjectOf<string>;
  hasMany?: ObjectOf<string>;
  hasOne?: ObjectOf<string>;
  manyToMany?: ObjectOf<string>;
  options?: Options;
};

export type Def = Required<DefInput>;

type DateTimeFields = {
  createdAt: string;
  updatedAt: string;
};

type IdField = {
  id: string;
};

type ConnectById = { connect: string };

type ToStatic<F extends ObjectOf<Runtype>> = { [K in keyof F]: Static<F[K]> };

type NonIdFields<D extends Def> = Omit<ToStatic<D['fields']>, 'id'>;

export type FullRecord<D extends Def> = Expand<
  IdField &
    NonIdFields<D> & { [K in keyof D['belongsTo']]: string } & {
      [K in keyof D['hasOne']]: string | null;
    } & DateTimeFields
>;

export type CreatedRecord<
  S extends ObjectOf<Def>,
  D extends S[keyof S],
> = Expand<
  IdField &
    NonIdFields<D> & {
      [K in keyof D['detachedFields']]: Static<D['detachedFields'][K]>;
    } & { [K in keyof D['belongsTo']]: string } & {
      [K in keyof D['hasMany']]: Array<CreatedRecord<S, S[D['hasMany'][K]]>>;
    } & {
      [K in keyof D['hasOne']]: CreatedRecord<S, S[D['hasOne'][K]]> | null;
    } & DateTimeFields
>;

type AdditionalFieldNames<S extends ObjectOf<Def>, D extends S[keyof S]> =
  | keyof D['detachedFields']
  | keyof D['belongsTo']
  | keyof D['hasMany']
  | keyof D['manyToMany']
  | keyof D['hasOne'];

type FullRecordIncl<
  S extends ObjectOf<Def>,
  D extends S[keyof S],
  I extends AdditionalFieldNames<S, D>,
> = Expand<
  IdField &
    NonIdFields<D> & {
      [K in keyof D['detachedFields']]: K extends I
        ? Static<D['detachedFields'][K]>
        : never;
    } & {
      [K in keyof D['belongsTo']]: K extends I
        ? FullRecord<S[D['belongsTo'][K]]>
        : string;
    } & {
      [K in keyof D['hasMany']]: K extends I
        ? Array<FullRecord<S[D['hasMany'][K]]>>
        : never;
    } & {
      [K in keyof D['manyToMany']]: K extends I
        ? Array<FullRecord<S[D['manyToMany'][K]]>>
        : never;
    } & {
      [K in keyof D['hasOne']]: K extends I
        ? FullRecord<S[D['hasOne'][K]]> | null
        : string | null;
    } & DateTimeFields
>;

// This is used for nested creates, specifically hasOne (see below)
type CreatableFieldsWithoutBelongsTo<
  S extends ObjectOf<Def>,
  D extends S[keyof S],
> = Expand<
  NonIdFields<D> & {
    [K in keyof D['detachedFields']]: Static<D['detachedFields'][K]>;
  } & {
    // In this case we actually want to exclude just the belongsTo field that
    // refers to the parent that we're creating, but I don't think that's
    // doable, so instead we're excluding all belongsTo. This should be fine
    // since an entity shouldn't belong to more than one parent.
    [K in keyof D['hasOne']]?: D['hasOne'][K] extends keyof S
      ? CreatableFieldsWithoutBelongsTo<S, S[D['hasOne'][K]]>
      : never;
  } & {
    [K in keyof D['hasMany']]?: D['hasMany'][K] extends keyof S
      ? Array<CreatableFieldsWithoutBelongsTo<S, S[D['hasMany'][K]]>>
      : never;
  } & { [K in keyof D['manyToMany']]?: Array<ConnectById> }
>;

type CreatableFields<S extends ObjectOf<Def>, D extends S[keyof S]> = Expand<
  { [K in keyof D['belongsTo']]: string } & CreatableFieldsWithoutBelongsTo<
    S,
    D
  >
>;

// This has everything CreatableFields has except the hasOne fields (no nested create)
export type CreatableFieldsSimple<D extends Def> = Expand<
  NonIdFields<D> & { [K in keyof D['belongsTo']]: string } & {
    [K in keyof D['detachedFields']]: Static<D['detachedFields'][K]>;
  } & { [K in keyof D['manyToMany']]?: Array<ConnectById> }
>;

export type UpdatableFields<D extends Def> = Expand<
  NonIdFields<D> & {
    [K in keyof D['detachedFields']]: Static<D['detachedFields'][K]>;
  }
>;

type HasManyNestedMethods<S extends ObjectOf<Def>, D extends S[keyof S]> = {
  [K in keyof D['hasMany']]: D['hasMany'][K] extends keyof S
    ? Expand<
        {
          getList: () => Promise<Array<string> | undefined>;
          getAll: MultipleRecordGetter<S, S[D['hasMany'][K]]>;
        } & ChainingMethods<S, S[D['hasMany'][K]]>
      >
    : never;
};

type ManyToManyNestedMethods<S extends ObjectOf<Def>, D extends S[keyof S]> = {
  [K in keyof D['manyToMany']]: D['manyToMany'][K] extends keyof S
    ? Expand<
        {
          getList: () => Promise<Array<string> | undefined>;
          getAll: MultipleRecordGetter<S, S[D['manyToMany'][K]]>;
          add: (idList: Array<string>) => Promise<void>;
          remove: (idList: Array<string>) => Promise<void>;
        } & ChainingMethods<S, S[D['manyToMany'][K]]>
      >
    : never;
};

// Represents a function that returns a single record of specified model; Takes
// an optional options param.
type SingleRecordGetter<
  S extends ObjectOf<Def>,
  D extends S[keyof S],
> = (() => Promise<FullRecord<D> | undefined>) &
  (<Incl extends IncludableFields<D>>(options: {
    include: IncludableFields<D> extends never
      ? undefined
      : { [K in Incl]?: true };
  }) => Promise<FullRecordIncl<S, D, Incl> | undefined>);

// Represents a function that returns an array of records of specified model;
// Takes an optional options param.
type MultipleRecordGetter<
  S extends ObjectOf<Def>,
  D extends S[keyof S],
> = (() => Promise<Array<FullRecord<D>> | undefined>) &
  (<Incl extends IncludableFields<D>>(options: {
    include: IncludableFields<D> extends never
      ? undefined
      : { [K in Incl]?: true };
  }) => Promise<Array<FullRecordIncl<S, D, Incl>> | undefined>);

type DetachedFieldGetters<S extends ObjectOf<Def>, D extends S[keyof S]> = {
  [K in keyof D['detachedFields']]: {
    get: () => Promise<Static<D['detachedFields'][K]> | undefined>;
  };
};

type HasOneGetters<S extends ObjectOf<Def>, D extends S[keyof S]> = {
  [K in keyof D['hasOne']]: {
    get: SingleRecordGetter<S, S[D['hasOne'][K]]>;
  };
};

type BelongsToGetters<S extends ObjectOf<Def>, D extends S[keyof S]> = {
  [K in keyof D['belongsTo']]: {
    get: SingleRecordGetter<S, S[D['belongsTo'][K]]>;
  };
};

// The list of fields you can "getBy" e.g. `getById`
type IndexableFields<D extends Def> = keyof D['indexes'] | 'id';

type IncludableFields<D extends Def> =
  | keyof D['detachedFields']
  | keyof D['belongsTo']
  | keyof D['hasMany']
  | keyof D['hasOne']
  | keyof D['manyToMany'];

// This is a conditional type such that any entity that does _not_ have a
// belongsTo will get a top-level `getList` method
type TopLevelGetAll<
  S extends ObjectOf<Def>,
  D extends S[keyof S],
> = keyof D['belongsTo'] extends never
  ? { getList: () => Promise<Array<string>> }
  : { [_: string]: never };

// These methods can be called after you get a sort of "instance" of a record
// such as: db.user.byId(id).delete()
// TODO: Better name?
type InstanceMethods<S extends ObjectOf<Def>, D extends S[keyof S]> = {
  update: (
    data: Partial<UpdatableFields<D>>,
  ) => Promise<FullRecord<D> | undefined>;
  delete: () => Promise<void>;
};

type ChainingMethods<S extends ObjectOf<Def>, D extends S[keyof S]> = {
  [K in IndexableFields<D> as `by${Capitalize<string & K>}`]: (
    value: string,
  ) => Expand<
    { get: SingleRecordGetter<S, D> } & DetachedFieldGetters<S, D> &
      HasOneGetters<S, D> &
      BelongsToGetters<S, D> &
      HasManyNestedMethods<S, D> &
      ManyToManyNestedMethods<S, D> &
      InstanceMethods<S, D>
  >;
};

export type Model<S extends ObjectOf<Def>, D extends S[keyof S]> = {
  create: (fields: CreatableFields<S, D>) => Promise<CreatedRecord<S, D>>;
} & TopLevelGetAll<S, D> &
  ChainingMethods<S, D>;

export type BaseEntity<M> = M extends Model<infer _S, infer D>
  ? FullRecord<D>
  : never;
