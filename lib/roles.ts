import type { Role } from "./types";

export type Permission =
  | "reports.read"
  | "reports.handle"
  | "reports.bulk"
  | "reports.moderate"
  | "reports.export"
  | "analytics.read"
  | "users.manage"
  | "audit.read"
  | "settings.manage";

export const ROLE_INFO: Record<Role, { name: string; description: string; permissions: Permission[] }> = {
  MODERATOR: {
    name: "Moderator",
    description: "Controleert publieke meldingen, foto's en misbruikrapportages.",
    permissions: ["reports.read", "reports.moderate"],
  },
  MUNICIPAL_OPERATOR: {
    name: "Medewerker gemeente",
    description: "Beoordeelt, wijst toe en handelt meldingen af binnen de eigen categorieën.",
    permissions: ["reports.read", "reports.handle", "analytics.read"],
  },
  TEAM_MANAGER: {
    name: "Teamleider",
    description: "Verdeelt werk, gebruikt bulkacties en ziet teamrapportages.",
    permissions: ["reports.read", "reports.handle", "reports.bulk", "reports.export", "analytics.read"],
  },
  POLICE_OPERATOR: {
    name: "Medewerker politie",
    description: "Ziet alleen de veiligheidscategorieën waarvoor de organisatie bevoegd is.",
    permissions: ["reports.read", "reports.handle", "analytics.read"],
  },
  ANALYST: {
    name: "Analist",
    description: "Ziet alleen geaggregeerde rapportages, geen individuele dossiers.",
    permissions: ["analytics.read", "reports.export"],
  },
  ORG_ADMIN: {
    name: "Beheerder organisatie",
    description: "Beheert gebruikers, rollen en instellingen van de eigen organisatie.",
    permissions: ["users.manage", "audit.read", "settings.manage", "analytics.read"],
  },
  PLATFORM_ADMIN: {
    name: "Platformbeheerder",
    description: "Beheert het platform, zonder automatisch toegang tot inhoudelijke dossiers.",
    permissions: ["users.manage", "audit.read", "settings.manage"],
  },
};

export const ROLES = Object.keys(ROLE_INFO) as Role[];

export function can(role: Role, permission: Permission): boolean {
  return ROLE_INFO[role].permissions.includes(permission);
}
