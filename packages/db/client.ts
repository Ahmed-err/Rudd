import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type DbType = ReturnType<typeof drizzle<typeof schema>>;

let _db: DbType | undefined;

const isLocalUrl = (url: string): boolean => {
  try {
    return ["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
};

// Neon's HTTP driver can't reach a plain Postgres, so local development and tests
// use node-postgres. Both drivers expose the same query builder.
const create = (url: string): DbType => {
  if (isLocalUrl(url)) {
    // biome-ignore lint/style/noCommonJs: loaded lazily so serverless bundles never include pg
    const { Pool } = require("pg") as typeof import("pg");
    // biome-ignore lint/style/noCommonJs: see above
    const { drizzle: drizzlePg } = require("drizzle-orm/node-postgres") as typeof import("drizzle-orm/node-postgres");
    return drizzlePg(new Pool({ connectionString: url }), { schema }) as unknown as DbType;
  }
  return drizzle(neon(url), { schema });
};

// Lazy singleton so builds without DATABASE_URL don't crash.
export const db = new Proxy({} as DbType, {
  get(_, prop, receiver) {
    if (!_db) {
      const url = process.env.DATABASE_URL;
      if (!url) throw new Error("DATABASE_URL is not set");
      _db = create(url);
    }
    return Reflect.get(_db, prop, receiver);
  },
});

export type Db = DbType;
