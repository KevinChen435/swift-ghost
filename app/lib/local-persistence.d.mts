export type WritableStorage = Pick<Storage, "setItem">;

export function persistJson(
  storage: WritableStorage,
  key: string,
  value: unknown,
): boolean;

export function persistJsonProperty(
  owner: object,
  property: string,
  key: string,
  value: unknown,
): boolean;
