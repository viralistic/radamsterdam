import type { CategoryCode, Visibility } from "./categories";

export interface LatLng {
  lat: number;
  lng: number;
}

/** Opgeslagen status. "expired" wordt meestal afgeleid uit expiresAt. */
export type ReportStatus =
  | "new"
  | "confirmed"
  | "in_progress"
  | "resolved"
  | "expired"
  | "withdrawn"
  | "under_review";

export type ConfirmationType = "present" | "gone" | "wrong_location" | "wrong_category" | "duplicate";

export type FlagReason = "abuse" | "personal_data" | "false_report" | "discrimination" | "other";

export type ResolutionCode =
  | "REPAIRED"
  | "CLEANED"
  | "REFERRED_CARE"
  | "NOT_CONFIRMED"
  | "OUT_OF_SCOPE"
  | "DUPLICATE"
  | "COMMUNITY";

export interface Report {
  id: string;
  number: string;
  category: CategoryCode;
  reporterId: string | null;
  location: LatLng;
  publicLocation: LatLng;
  area: string;
  street: string | null;
  description: string;
  /** Interne toelichting voor de beoordelaar, nooit publiek. */
  reviewerNote: string;
  visibility: Visibility;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
  lastConfirmedAt: string;
  expiresAt: string | null;
  mediaIds: string[];
  orgId: string;
  duplicateOf: string | null;
  priority: "low" | "normal" | "high";
  resolvedAt: string | null;
  resolutionCode: ResolutionCode | null;
  firstReviewedAt: string | null;
  anonymized?: boolean;
}

export interface Confirmation {
  id: string;
  reportId: string;
  userId: string;
  type: ConfirmationType;
  createdAt: string;
}

export interface Flag {
  id: string;
  reportId: string;
  userId: string;
  reason: FlagReason;
  createdAt: string;
  status: "open" | "dismissed" | "upheld";
}

export interface Media {
  id: string;
  reportId: string | null;
  ownerId: string;
  mime: string;
  size: number;
  moderationStatus: "pending" | "approved" | "rejected";
  createdAt: string;
  deleteAfter: string;
}

export interface Assignment {
  id: string;
  reportId: string;
  orgId: string;
  assignedTo: string | null;
  team: string | null;
  status: "open" | "in_progress" | "closed";
  dueAt: string | null;
  createdAt: string;
  closedAt: string | null;
  resolutionCode: ResolutionCode | null;
}

export type ReportEventType =
  | "created"
  | "confirmed"
  | "correction"
  | "flagged"
  | "status_changed"
  | "assigned"
  | "note"
  | "visibility_changed"
  | "media_moderated"
  | "reopened"
  | "expired";

export interface ReportEvent {
  id: string;
  reportId: string;
  type: ReportEventType;
  actorId: string | null;
  actorLabel: string;
  createdAt: string;
  /** Interne events zijn nooit zichtbaar voor inwoners. */
  internal: boolean;
  message: string;
  metadata?: Record<string, unknown>;
}

export type OrgType = "municipality" | "enforcement" | "police" | "care" | "platform";

export interface Organization {
  id: string;
  name: string;
  type: OrgType;
  categories: CategoryCode[];
  areas: string[];
  responseHours: number;
}

export type Role =
  | "MODERATOR"
  | "MUNICIPAL_OPERATOR"
  | "TEAM_MANAGER"
  | "POLICE_OPERATOR"
  | "ANALYST"
  | "ORG_ADMIN"
  | "PLATFORM_ADMIN";

export interface ProUser {
  id: string;
  name: string;
  email: string;
  orgId: string;
  role: Role;
  active: boolean;
  lastLoginAt: string | null;
}

export interface AuditEntry {
  id: string;
  actorId: string;
  actorName: string;
  orgId: string;
  action: string;
  target: string | null;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface CategoryConfig {
  ttlHours?: number | null;
  visibility?: Visibility;
  active?: boolean;
  orgId?: string;
}

export interface FollowedArea {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
  categories: CategoryCode[];
}

export interface CitizenPrefs {
  areas: FollowedArea[];
  notifications: {
    mode: "urgent" | "all" | "digest" | "off";
    digest: "daily" | "weekly";
    quietFrom: string;
    quietTo: string;
  };
}

/** Publieke weergave van een melding, zoals de API die aan inwoners teruggeeft. */
export interface PublicReport {
  id: string;
  number: string;
  category: CategoryCode;
  location: LatLng;
  approximate: boolean;
  area: string;
  street: string | null;
  text: string;
  status: ReportStatus;
  createdAt: string;
  lastConfirmedAt: string;
  expiresAt: string | null;
  confirmations: number;
  reliability: "low" | "medium" | "high";
  photoUrl: string | null;
  isMine: boolean;
  myConfirmation: ConfirmationType | null;
  myFlagged: boolean;
}

export interface PublicEvent {
  id: string;
  type: ReportEventType;
  createdAt: string;
  message: string;
}
