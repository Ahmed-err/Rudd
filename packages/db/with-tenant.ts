import { eq, and, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/**
 * Returns a WHERE clause that scopes a query to a specific tenant.
 *
 * Usage:
 *   .where(withTenant(tenantId, table.tenantId))
 *   .where(and(withTenant(tenantId, table.tenantId), eq(table.status, "active")))
 */
export const withTenant = (tenantId: string, col: AnyPgColumn): SQL =>
  eq(col, tenantId);

/**
 * Combines the tenant scope with an additional condition.
 * Convenience for the common pattern: and(withTenant(...), eq(...))
 */
export const withTenantAnd = (
  tenantId: string,
  col: AnyPgColumn,
  ...conditions: SQL[]
): SQL => and(eq(col, tenantId), ...conditions) as SQL;
