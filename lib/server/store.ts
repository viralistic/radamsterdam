import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import type {
  Assignment,
  AuditEntry,
  CategoryConfig,
  CitizenPrefs,
  Confirmation,
  Flag,
  Media,
  Organization,
  ProUser,
  Report,
  ReportEvent,
} from "../types";
import type { CategoryCode } from "../categories";
import { createSeed } from "./seed";
import { runRetention } from "./retention";

export interface DB {
  schemaVersion: number;
  version: number;
  reportCounter: number;
  reports: Report[];
  confirmations: Confirmation[];
  flags: Flag[];
  media: Media[];
  assignments: Assignment[];
  events: ReportEvent[];
  organizations: Organization[];
  proUsers: ProUser[];
  audit: AuditEntry[];
  categoryConfig: Partial<Record<CategoryCode, CategoryConfig>>;
  prefs: Record<string, CitizenPrefs>;
  lastRetentionAt: string | null;
}

const SCHEMA_VERSION = 1;

function resolveDataDir(): string {
  const preferred = process.env.DATA_DIR || path.join(process.cwd(), ".data");
  try {
    fs.mkdirSync(preferred, { recursive: true });
    fs.accessSync(preferred, fs.constants.W_OK);
    return preferred;
  } catch {
    // Bijvoorbeeld op een read-only serverless omgeving.
    const fallback = path.join(os.tmpdir(), "straatradar");
    fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}

interface StoreState {
  db: DB;
  dir: string;
  saveTimer: NodeJS.Timeout | null;
  emitter: EventEmitter;
}

const g = globalThis as unknown as { __straatradar?: StoreState };

function init(): StoreState {
  const dir = resolveDataDir();
  fs.mkdirSync(path.join(dir, "media"), { recursive: true });
  const file = path.join(dir, "db.json");
  let db: DB | null = null;
  if (fs.existsSync(file)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as DB;
      if (parsed.schemaVersion === SCHEMA_VERSION) db = parsed;
    } catch {
      db = null;
    }
  }
  if (!db) {
    db = { ...createSeed(new Date()), schemaVersion: SCHEMA_VERSION };
    fs.writeFileSync(file, JSON.stringify(db));
  }
  const emitter = new EventEmitter();
  emitter.setMaxListeners(1000);
  return { db, dir, saveTimer: null, emitter };
}

function state(): StoreState {
  if (!g.__straatradar) g.__straatradar = init();
  return g.__straatradar;
}

export function dataDir(): string {
  return state().dir;
}

export function mediaPath(id: string): string {
  if (!/^[a-z0-9-]+$/i.test(id)) throw new Error("Ongeldige media-id");
  return path.join(state().dir, "media", `${id}.bin`);
}

function scheduleSave() {
  const s = state();
  if (s.saveTimer) return;
  s.saveTimer = setTimeout(() => {
    s.saveTimer = null;
    const file = path.join(s.dir, "db.json");
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(s.db));
    fs.renameSync(tmp, file);
  }, 150);
}

/** Leest de database. Voert periodiek bewaartermijnen uit. */
export function read(): DB {
  const s = state();
  const last = s.db.lastRetentionAt ? new Date(s.db.lastRetentionAt).getTime() : 0;
  if (Date.now() - last > 10 * 60_000) {
    runRetention(s.db, new Date(), (id) => {
      try {
        fs.rmSync(mediaPath(id), { force: true });
      } catch {
        /* bestand al weg */
      }
    });
    s.db.lastRetentionAt = new Date().toISOString();
    scheduleSave();
  }
  return s.db;
}

/** Voert een wijziging uit, bewaart en informeert live luisteraars. */
export function mutate<T>(fn: (db: DB) => T): T {
  const s = state();
  const result = fn(read());
  s.db.version += 1;
  scheduleSave();
  s.emitter.emit("change", s.db.version);
  return result;
}

export function onChange(listener: (version: number) => void): () => void {
  const s = state();
  s.emitter.on("change", listener);
  return () => s.emitter.off("change", listener);
}

export function resetStore(): void {
  const s = state();
  s.db = { ...createSeed(new Date()), schemaVersion: SCHEMA_VERSION };
  s.emitter.emit("change", s.db.version);
  scheduleSave();
}

export function uid(prefix = ""): string {
  return prefix + crypto.randomUUID();
}
