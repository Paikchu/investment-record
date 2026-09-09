import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export async function getDb() {
  return drizzle(await getD1(), { schema });
}

export async function getD1(): Promise<D1Database> {
  const { env } = await import("cloudflare:workers");
  const database = (env as unknown as { DB?: D1Database }).DB;
  if (!database) throw new Error("Cloudflare D1 binding `DB` is unavailable.");
  return database;
}
