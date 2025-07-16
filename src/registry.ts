import type { Operation } from './operation';

// Type to extract operation from any nested structure
type ExtractOperations<T> = {
  [K in keyof T]: T[K] extends Operation<any>
    ? T[K]
    : T[K] extends Record<string, any>
      ? ExtractOperations<T[K]>
      : never;
};

// Registry class for object-based organization
class ObjectRegistry<T extends Record<string, any>> {
  constructor(private operations: T) {}

  select<R>(selector: (registry: ExtractOperations<T>) => R): R {
    return selector(this.operations as ExtractOperations<T>);
  }
}

// Registry class for array-based organization
class ArrayRegistry<T extends Operation<any>[]> {
  constructor(private operations: T) {}

  select<R>(selector: (registry: T) => R): R {
    return selector(this.operations);
  }
}

// Overloaded registry function
export function registry<T extends Record<string, any>>(operations: T): ObjectRegistry<T>;
export function registry<T extends Operation<any>[]>(operations: T): ArrayRegistry<T>;
export function registry<T extends Record<string, any> | Operation<any>[]>(
  operations: T,
): T extends Operation<any>[] ? ArrayRegistry<T> : ObjectRegistry<T> {
  if (Array.isArray(operations)) {
    return new ArrayRegistry(operations) as any;
  } else {
    return new ObjectRegistry(operations) as any;
  }
}

export type { Operation, ObjectRegistry, ArrayRegistry };
