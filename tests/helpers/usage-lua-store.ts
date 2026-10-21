import { LuaFactory, type LuaEngine } from "wasmoon";
import type { UsageStore } from "../../lib/usage-control.ts";

type Hash = { kind: "hash"; values: Map<string, number>; expires?: number };
type SortedSet = { kind: "zset"; values: Map<string, number>; expires?: number };

/** Offline Redis command semantics only; all admission decisions use production Lua. */
export class LuaUsageBackend {
  now = Date.UTC(2026, 9, 21, 12);
  records = new Map<string, Hash | SortedSet>();
  private engine: LuaEngine;
  private tail: Promise<unknown> = Promise.resolve();

  private constructor(engine: LuaEngine) {
    this.engine = engine;
    engine.global.set("redis", { call: (command: string, ...args: (string | number)[]) => this.command(command, args) });
  }

  static async create() {
    return new LuaUsageBackend(await new LuaFactory().createEngine({ injectObjects: false, enableProxy: false }));
  }

  private read(key: string) {
    const entry = this.records.get(key);
    if (entry?.expires !== undefined && entry.expires <= this.now) { this.records.delete(key); return undefined; }
    return entry;
  }

  private command(command: string, args: (string | number)[]): unknown {
    if (command === "TIME") return [String(Math.floor(this.now / 1000)), String((this.now % 1000) * 1000)];
    const [key, field, amount] = args.map(String);
    const entry = this.read(key);
    if (command === "TTL") return !entry ? -2 : entry.expires === undefined ? -1 : Math.floor((entry.expires - this.now) / 1000);
    if (command === "EXPIRE" || command === "PEXPIRE") {
      if (!entry) return 0;
      entry.expires = this.now + Number(field) * (command === "EXPIRE" ? 1000 : 1); return 1;
    }
    if (command === "HGET") {
      if (entry && entry.kind !== "hash") throw new Error("WRONGTYPE");
      const value = entry?.values.get(field);
      return value === undefined ? false : String(value);
    }
    if (command === "HINCRBY") {
      if (entry && entry.kind !== "hash") throw new Error("WRONGTYPE");
      const hash = entry ?? { kind: "hash" as const, values: new Map<string, number>() };
      hash.values.set(field, (hash.values.get(field) ?? 0) + Number(amount));
      this.records.set(key, hash); return hash.values.get(field);
    }
    if (entry && entry.kind !== "zset") throw new Error("WRONGTYPE");
    if (command === "ZCARD") return entry?.values.size ?? 0;
    if (command === "ZADD") {
      const set = entry ?? { kind: "zset" as const, values: new Map<string, number>() };
      const previous = set.values.has(amount); set.values.set(amount, Number(field)); this.records.set(key, set); return previous ? 0 : 1;
    }
    if (command === "ZREM") {
      const removed = entry?.values.delete(field) ? 1 : 0;
      if (entry?.values.size === 0) this.records.delete(key);
      return removed;
    }
    if (command === "ZREMRANGEBYSCORE") {
      let count = 0;
      for (const [member, score] of entry?.values ?? []) if (score >= Number(field) && score <= Number(amount)) { entry!.values.delete(member); count++; }
      if (entry?.values.size === 0) this.records.delete(key);
      return count;
    }
    if (command === "ZRANGE") {
      return [...(entry?.values ?? [])].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
        .slice(Number(field), Number(amount) + 1).flatMap(([member, score]) => [member, String(score)]);
    }
    throw new Error(`Unexpected offline Redis command: ${command}`);
  }

  client(): UsageStore {
    return { evaluate: (script, keys, args, signal) => {
      // Redis serializes each complete script. No JS implementation of its
      // admission/budget decision exists in this backend.
      const operation = this.tail.then(async () => {
        if (signal?.aborted) throw new Error("Offline command cancelled.");
        const top = this.engine.global.getTop();
        try {
          this.engine.global.set("KEYS", [...keys]);
          this.engine.global.set("ARGV", args.map(String));
          return await this.engine.doString(script);
        } finally {
          // Wasmoon's doString leaves returned values on its global stack.
          // Restore it between Redis commands so repeated evaluations are bounded.
          this.engine.global.setTop(top);
        }
      });
      this.tail = operation.catch(() => {});
      return operation;
    } };
  }

  async close() { await this.tail; this.engine.global.close(); }
}
