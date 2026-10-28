import type { ReportStatus, ResolutionCode } from "./types";

export const STATUS_LABEL: Record<ReportStatus, string> = {
  new: "Vers gemeld",
  confirmed: "Bevestigd",
  in_progress: "In behandeling",
  resolved: "Opgelost",
  expired: "Verlopen",
  withdrawn: "Ingetrokken",
  under_review: "In beoordeling",
};

export const STATUS_HELP: Record<ReportStatus, string> = {
  new: "Net gemeld en nog niet door anderen bevestigd.",
  confirmed: "Meerdere buren zien dit ook.",
  in_progress: "Een verantwoordelijke dienst heeft de melding opgepakt.",
  resolved: "Afgehandeld volgens de dienst of genoeg buren.",
  expired: "Te lang niet bevestigd om nog als actueel te tonen.",
  withdrawn: "Door de melder of een moderator ingetrokken.",
  under_review: "Tijdelijk verborgen terwijl een moderator kijkt.",
};

export const RESOLUTION_LABEL: Record<ResolutionCode, string> = {
  REPAIRED: "Gerepareerd",
  CLEANED: "Opgeruimd",
  REFERRED_CARE: "Doorgezet naar hulpverlening",
  NOT_CONFIRMED: "Niet bevestigd",
  OUT_OF_SCOPE: "Buiten bevoegdheid",
  DUPLICATE: "Dubbele melding",
  COMMUNITY: "Volgens buren verdwenen",
};

export const LIVE_STATUSES: ReportStatus[] = ["new", "confirmed", "in_progress"];
