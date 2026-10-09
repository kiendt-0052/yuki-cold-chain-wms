// RBAC (NFR-SEC-02, simplified): every logged-in role can read; writes need the action's role.
import type { Role } from "@/lib/domain/labels";

export const PERMISSIONS = {
  "inbound:write": ["admin", "receiving"],
  "lot:quality": ["admin", "qa"],
  "order:allocate": ["admin", "dispatcher"],
  "order:ship": ["admin", "dispatcher", "receiving"],
  "order:deliver": ["admin", "dispatcher"],
  "temperature:import": ["admin", "qa"],
  "alarm:review": ["admin", "qa"],
  "deviation:decide": ["admin", "qa"],
  "route:edit": ["admin", "dispatcher"],
  "master:edit": ["admin"],
  "demo:reset": ["admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | undefined, permission: Permission): boolean {
  return !!role && (PERMISSIONS[permission] as readonly Role[]).includes(role);
}
