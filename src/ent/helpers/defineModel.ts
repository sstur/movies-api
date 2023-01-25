import type { Def, DefInput } from '../helpers';

export function defineModel<D extends DefInput>(
  def: D,
): {
  [K in keyof Def]: unknown extends D[K] ? { [N in never]: never } : D[K];
} {
  return {
    ...def,
    detachedFields: def.detachedFields ?? {},
    indexes: def.indexes ?? {},
    belongsTo: def.belongsTo ?? {},
    hasMany: def.hasMany ?? {},
    hasOne: def.hasOne ?? {},
    manyToMany: def.manyToMany ?? {},
    options: def.options ?? {},
  };
}
