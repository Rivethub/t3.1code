import * as Schema from "effect/Schema";
import { TrimmedNonEmptyString } from "./baseSchemas.ts";

export const MEMORY_PARTITION = "persist:t3-rivethub-memory";
export const MEMORY_INSTALL_COMMAND = "curl -fsSL https://get.rivethub.io/local.sh | bash";

export const MemoryNodeAction = Schema.Literals(["open", "status", "install", "start"]);
export type MemoryNodeAction = typeof MemoryNodeAction.Type;

export const MemoryNodeState = Schema.Union([
  Schema.TaggedStruct("unsupported", {}),
  Schema.TaggedStruct("not-installed", {}),
  Schema.TaggedStruct("checking", {}),
  Schema.TaggedStruct("installing", { output: Schema.String }),
  Schema.TaggedStruct("not-running", {}),
  Schema.TaggedStruct("starting", {}),
  Schema.TaggedStruct("no-ui", {}),
  Schema.TaggedStruct("ready", { origin: Schema.String, signedInUrl: Schema.String }),
  Schema.TaggedStruct("failed", { reason: Schema.String }),
]);
export type MemoryNodeState = typeof MemoryNodeState.Type;

const shortText = TrimmedNonEmptyString.check(Schema.isMaxLength(4096));
export const MemoryOpenSessionRequest = Schema.Struct({
  sessionId: shortText,
  harness: shortText,
  title: shortText,
  startedAt: Schema.String.check(
    Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u),
    Schema.makeFilter((date) => Number.isFinite(Date.parse(date))),
  ),
  cwd: Schema.optionalKey(shortText),
  nativeSessionId: Schema.optionalKey(shortText),
  resumeCommand: Schema.optionalKey(shortText),
  handoffPrompt: TrimmedNonEmptyString.check(Schema.isMaxLength(131072)),
});
export type MemoryOpenSessionRequest = typeof MemoryOpenSessionRequest.Type;

export type MemoryOpenSessionResult =
  | { opened: true; how: "resumed" | "handoff" }
  | { opened: false; reason: string };

export function loopbackHttpUrl(raw: string): URL | null {
  const url = URL.parse(raw);
  if (
    !url ||
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    (url.hostname !== "localhost" && url.hostname !== "127.0.0.1" && url.hostname !== "[::1]") ||
    url.username ||
    url.password
  )
    return null;
  return url;
}

export function memoryLinkPath(origin: string, raw: string): string | null {
  const url = loopbackHttpUrl(raw);
  if (!url || url.origin !== origin) return null;
  return url.pathname + url.search + url.hash;
}

export function memoryPageUrl(origin: string, path: string): string {
  const candidate = URL.parse(path, origin);
  return candidate && memoryLinkPath(origin, candidate.href) !== null
    ? candidate.href
    : new URL("/", origin).href;
}
