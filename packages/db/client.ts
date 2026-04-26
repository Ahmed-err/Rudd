import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type DbType = ReturnType<typeof drizzle<typeof schema>>;

let _db: DbType | undefined;

// Lazy singleton — initializes on first access, not at module load time.
// This prevents build-time crashes when DATABASE_URL isn't set yet.
export const db = new Proxy({} as DbType, {
  get(_, prop, receiver) {
    if (!_db) {
      const url = process.env.DATABASE_URL;
      if (!url) throw new Error("DATABASE_URL is not set");
      _db = drizzle(neon(url), { schema });
    }
    return Reflect.get(_db, prop, receiver);
  },
});

export type Db = DbType;
