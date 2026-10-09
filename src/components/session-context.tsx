"use client";
import { createContext, useContext } from "react";
import type { Role } from "@/lib/domain/labels";
import type { Permission } from "@/lib/permissions";

export type Me = { user: { id: string; loginId: string; name: string; role: Role }; permissions: Permission[] };

export const SessionContext = createContext<Me | null>(null);

/** UI-level permission check (hides buttons). The API re-checks every write. */
export function useSession() {
  const me = useContext(SessionContext);
  return {
    me,
    can: (p: Permission) => !!me?.permissions.includes(p),
  };
}
