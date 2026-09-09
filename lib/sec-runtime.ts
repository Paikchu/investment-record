/** Configuration retained only for the read-only historical SEC export endpoint. */
export async function getSecRuntimeConfig(): Promise<{ migrationKey: string }> {
  const { env } = await import("cloudflare:workers");
  const key = (env as unknown as Record<string, unknown>).SEC_MIGRATION_KEY;
  return { migrationKey: typeof key === "string" ? key.trim() : "" };
}
