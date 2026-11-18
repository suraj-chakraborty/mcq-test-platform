export class Redis {
  private static store = new Map<string, any>();

  constructor() {}

  get = jest.fn().mockImplementation(async (key: string) => {
    return Redis.store.get(key) || null;
  });

  set = jest.fn().mockImplementation(async (key: string, value: any, options?: any) => {
    if (options?.nx && Redis.store.has(key)) {
      return null;
    }
    Redis.store.set(key, value);
    return 'OK';
  });

  del = jest.fn().mockImplementation(async (key: string) => {
    const existed = Redis.store.delete(key);
    return existed ? 1 : 0;
  });

  evalsha = jest.fn().mockResolvedValue([1, 10, Date.now() + 60000]);
  eval = jest.fn().mockResolvedValue([1, 10, Date.now() + 60000]);

  static clear() {
    Redis.store.clear();
  }
}
