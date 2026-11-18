import {
  MemoryOpenSessionRequest,
  ProviderDriverKind,
  type AgentSessionImportTarget,
  type MemoryOpenSessionResult,
} from "@t3tools/contracts";
import * as Schema from "effect/Schema";

const decodeRequest = Schema.decodeUnknownOption(MemoryOpenSessionRequest);

function targetFor(input: MemoryOpenSessionRequest): AgentSessionImportTarget | undefined {
  if (!input.nativeSessionId) return undefined;
  const harness = input.harness.toLowerCase();
  switch (harness) {
    case "claude":
    case "claude-code":
    case "claudeagent":
      return {
        driver: ProviderDriverKind.make("claudeAgent"),
        nativeSessionId: input.nativeSessionId,
      };
    case "grok-build":
      return { driver: ProviderDriverKind.make("grok"), nativeSessionId: input.nativeSessionId };
    case "codex":
    case "cursor":
    case "grok":
    case "opencode":
    case "antigravity":
    case "kiro":
    case "pi":
    case "muse":
    case "fx":
      return { driver: ProviderDriverKind.make(harness), nativeSessionId: input.nativeSessionId };
    default:
      return undefined;
  }
}

export async function openMemorySession<Destination>(
  raw: unknown,
  actions: {
    resume: (
      request: MemoryOpenSessionRequest,
      target: AgentSessionImportTarget,
    ) => Promise<Destination | null>;
    handoff: (request: MemoryOpenSessionRequest) => Promise<Destination | null>;
  },
): Promise<{ result: MemoryOpenSessionResult; destination?: Destination }> {
  const request = decodeRequest(raw);
  if (request._tag === "None") {
    return {
      result: {
        opened: false,
        reason: "RivetHub sent invalid session details. Open the session in Memory and try again.",
      },
    };
  }
  const input = request.value;
  const target = targetFor(input);
  if (target) {
    const destination = await actions.resume(input, target).catch(() => null);
    if (destination !== null) return { result: { opened: true, how: "resumed" }, destination };
  }
  const destination = await actions.handoff(input).catch(() => null);
  if (destination !== null) return { result: { opened: true, how: "handoff" }, destination };
  return {
    result: {
      opened: false,
      reason:
        "Connect the local T3.1 Code environment and add the session’s project, then try again.",
    },
  };
}
