-- StraatRadar productieschema: PostgreSQL 15+ met PostGIS.
-- De demo gebruikt een JSON-opslag (lib/server/store.ts) met exact dezelfde entiteiten.
-- Bij migratie vervang je store.ts door een repository op deze tabellen.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE visibility AS ENUM ('public', 'public_fuzzy', 'professional');
CREATE TYPE report_status AS ENUM ('new', 'confirmed', 'in_progress', 'resolved', 'expired', 'withdrawn', 'under_review');
CREATE TYPE confirmation_type AS ENUM ('present', 'gone', 'wrong_location', 'wrong_category', 'duplicate');
CREATE TYPE pro_role AS ENUM ('MODERATOR', 'MUNICIPAL_OPERATOR', 'TEAM_MANAGER', 'POLICE_OPERATOR', 'ANALYST', 'ORG_ADMIN', 'PLATFORM_ADMIN');

CREATE TABLE organizations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  type            text NOT NULL CHECK (type IN ('municipality', 'enforcement', 'police', 'care', 'platform')),
  response_hours  int  NOT NULL DEFAULT 72,
  work_area       geometry(MultiPolygon, 4326)
);

CREATE TABLE categories (
  code               text PRIMARY KEY,
  name               text NOT NULL,
  category_group     text NOT NULL,
  default_ttl_hours  int,                -- NULL = actueel tot opgelost (max 30 dagen zonder bevestiging)
  default_visibility visibility NOT NULL,
  default_org_id     uuid REFERENCES organizations(id),
  active             boolean NOT NULL DEFAULT true
);

CREATE TABLE organization_categories (
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  category_code   text REFERENCES categories(code),
  PRIMARY KEY (organization_id, category_code)
);

CREATE TABLE citizens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),   -- anoniem apparaat-ID
  created_at  timestamptz NOT NULL DEFAULT now(),
  preferences jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE pro_users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name            text NOT NULL,
  email           citext UNIQUE NOT NULL,
  role            pro_role NOT NULL,
  active          boolean NOT NULL DEFAULT true,
  last_login_at   timestamptz
);

CREATE TABLE incidents (                  -- meerdere meldingen kunnen naar één incident verwijzen
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category   text REFERENCES categories(code),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reports (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number            text UNIQUE NOT NULL,
  category          text NOT NULL REFERENCES categories(code),
  reporter_id       uuid REFERENCES citizens(id) ON DELETE SET NULL,
  location          geometry(Point, 4326) NOT NULL,   -- intern, exact
  public_location   geometry(Point, 4326) NOT NULL,   -- publiek, afgerond bij gevoelige categorieën
  area              text NOT NULL,
  street            text,
  description       text NOT NULL DEFAULT '',
  reviewer_note     text NOT NULL DEFAULT '',
  visibility        visibility NOT NULL,
  status            report_status NOT NULL DEFAULT 'new',
  priority          text NOT NULL DEFAULT 'normal',
  organization_id   uuid NOT NULL REFERENCES organizations(id),
  incident_id       uuid REFERENCES incidents(id),
  duplicate_of      uuid REFERENCES reports(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  last_confirmed_at timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz,
  first_reviewed_at timestamptz,
  resolved_at       timestamptz,
  resolution_code   text,
  anonymized        boolean NOT NULL DEFAULT false
);
CREATE INDEX reports_location_gix ON reports USING gist (location);
CREATE INDEX reports_public_location_gix ON reports USING gist (public_location);
CREATE INDEX reports_live_idx ON reports (status, expires_at) WHERE status IN ('new', 'confirmed', 'in_progress');
CREATE INDEX reports_category_created_idx ON reports (category, created_at DESC);

CREATE TABLE report_confirmations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id  uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL,
  type       confirmation_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, user_id)              -- één actieve stem per persoon
);

CREATE TABLE report_flags (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id  uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL,
  reason     text NOT NULL,
  status     text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, user_id)
);

CREATE TABLE report_media (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id         uuid REFERENCES reports(id) ON DELETE CASCADE,
  owner_id          uuid NOT NULL,
  storage_key       text NOT NULL,         -- private object storage, alleen via ondertekende links
  mime              text NOT NULL,
  moderation_status text NOT NULL DEFAULT 'pending',
  created_at        timestamptz NOT NULL DEFAULT now(),
  delete_after      timestamptz NOT NULL
);

CREATE TABLE assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  assigned_to     uuid REFERENCES pro_users(id),
  team            text,
  status          text NOT NULL,
  due_at          timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  closed_at       timestamptz,
  resolution_code text
);

CREATE TABLE report_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  event_type  text NOT NULL,
  actor_id    uuid,
  actor_label text NOT NULL,
  internal    boolean NOT NULL DEFAULT false,
  message     text NOT NULL,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Auditlog: alleen toevoegen. Geef de applicatierol geen UPDATE of DELETE.
CREATE TABLE audit_log (
  id              bigserial PRIMARY KEY,
  actor_id        uuid NOT NULL,
  organization_id uuid NOT NULL,
  action          text NOT NULL,
  target          text,
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC;

-- Voorbeeld: actuele publieke meldingen in een kaartvlak.
-- SELECT id, ST_AsGeoJSON(public_location) FROM reports
--  WHERE visibility <> 'professional' AND status IN ('new','confirmed','in_progress')
--    AND (expires_at IS NULL OR expires_at > now())
--    AND public_location && ST_MakeEnvelope(:w, :s, :e, :n, 4326);
