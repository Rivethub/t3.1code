// @effect-diagnostics cryptoRandomUUID:off globalTimers:off -- The sandboxed preload uses Chromium APIs without a runtime dependency.
import { contextBridge, ipcRenderer } from "electron";
import type { MemoryOpenSessionRequest, MemoryOpenSessionResult } from "@t3tools/contracts";

import { MEMORY_APPEARANCE_CHANNEL, MEMORY_APPEARANCE_CHANGED_CHANNEL } from "./ipc/channels.ts";

type Appearance = "dark" | "light";
let appearance: Appearance =
  ipcRenderer.sendSync(MEMORY_APPEARANCE_CHANNEL) === "dark" ? "dark" : "light";
const appearanceListeners = new Set<(next: Appearance) => void>();
ipcRenderer.on(MEMORY_APPEARANCE_CHANGED_CHANNEL, (_event, next: unknown) => {
  if ((next !== "dark" && next !== "light") || next === appearance) return;
  appearance = next;
  for (const listener of appearanceListeners) listener(next);
});
const pending = new Map<string, (value: unknown) => void>();

ipcRenderer.on("rivethub-memory:reply", (_event, id: string, value: unknown) => {
  pending.get(id)?.(value);
});

function request(kind: "relogin" | "open-session", payload?: unknown): Promise<unknown> {
  if (pending.size >= 4) return Promise.resolve(null);
  return new Promise((resolve) => {
    const id = crypto.randomUUID();
    const timeout = setTimeout(() => finish(null), 60_000);
    const finish = (value: unknown) => {
      clearTimeout(timeout);
      pending.delete(id);
      resolve(value);
    };
    pending.set(id, finish);
    try {
      ipcRenderer.sendToHost("rivethub-memory:request", id, kind, payload);
    } catch {
      finish(null);
    }
  });
}

contextBridge.exposeInMainWorld("rivethub", {
  async relogin(): Promise<string | null> {
    const result = await request("relogin").catch(() => null);
    return typeof result === "string" ? result : null;
  },
  host: {
    name: "T3.1 Code",
    appearance: {
      get: () => appearance,
      onChange(listener: (next: Appearance) => void) {
        appearanceListeners.add(listener);
        return () => {
          appearanceListeners.delete(listener);
        };
      },
    },
    async openSession(input: MemoryOpenSessionRequest): Promise<MemoryOpenSessionResult> {
      return (
        ((await request("open-session", input).catch(
          () => null,
        )) as MemoryOpenSessionResult | null) ?? {
          opened: false,
          reason: "T3.1 Code could not open the session. Try again from Memory.",
        }
      );
    },
  },
});
