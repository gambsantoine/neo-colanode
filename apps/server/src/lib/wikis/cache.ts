// Small least-recently-used map, kept in the memory of each server instance.
export class LruCache<K, V> {
  private readonly items = new Map<K, V>();

  constructor(private readonly maxSize: number) {}

  public get(key: K): V | undefined {
    const value = this.items.get(key);
    if (value !== undefined) {
      this.items.delete(key);
      this.items.set(key, value);
    }

    return value;
  }

  public set(key: K, value: V): void {
    this.items.delete(key);
    this.items.set(key, value);

    while (this.items.size > this.maxSize) {
      const oldest = this.items.keys().next().value as K;
      this.items.delete(oldest);
    }
  }

  public delete(key: K): void {
    this.items.delete(key);
  }

  public get size(): number {
    return this.items.size;
  }
}
