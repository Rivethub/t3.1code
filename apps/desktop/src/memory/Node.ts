import {
  loopbackHttpUrl,
  memoryLinkPath,
  type MemoryNodeAction,
  type MemoryNodeState,
} from "@t3tools/contracts";

export function parseLoginUrl(output: string) {
  for (const line of output.split("\n")) {
    const url = loopbackHttpUrl(line.trim());
    if (url?.pathname !== "/login") continue;
    const code = new URLSearchParams(url.hash.slice(1)).get("code");
    if (code && /^[a-zA-Z0-9_-]{1,256}$/u.test(code)) return { url, code };
  }
  return null;
}

interface NodeOperations {
  supported: boolean;
  find: () => Promise<string | null>;
  status: (rh: string) => Promise<"running" | "stopped">;
  login: (rh: string) => Promise<string>;
  probe: (origin: string) => Promise<number>;
  install: (write: (output: string) => void) => Promise<void>;
  start: (rh: string) => Promise<void>;
}

export function createMemoryNode(ops: NodeOperations) {
  let state: MemoryNodeState = ops.supported ? { _tag: "checking" } : { _tag: "unsupported" };
  let pending: Promise<void> | undefined;
  let origin: string | null = null;

  async function detect(): Promise<MemoryNodeState> {
    const rh = await ops.find();
    if (!rh) return { _tag: "not-installed" };
    if ((await ops.status(rh)) === "stopped") return { _tag: "not-running" };
    const login = parseLoginUrl(await ops.login(rh));
    if (!login)
      throw new Error(
        "RivetHub did not return a local sign-in URL. Run rh status to diagnose the node.",
      );
    origin = login.url.origin;
    const status = await ops.probe(origin);
    if (status === 404) return { _tag: "no-ui" };
    if (status !== 200)
      throw new Error(
        `The RivetHub web app returned HTTP ${status}. Run rh status and check the gateway configuration.`,
      );
    return { _tag: "ready", origin, signedInUrl: login.url.href };
  }

  async function perform(action: MemoryNodeAction): Promise<MemoryNodeState> {
    if (action === "install") {
      state = { _tag: "installing", output: "Starting the RivetHub installer…\n" };
      await ops.install((output) => {
        if (state._tag === "installing") {
          state = { _tag: "installing", output: (state.output + output).slice(-24000) };
        }
      });
    } else if (action === "start") {
      state = { _tag: "starting" };
      const rh = await ops.find();
      if (rh && (await ops.status(rh)) === "stopped") await ops.start(rh);
    } else {
      state = { _tag: "checking" };
    }
    return detect();
  }

  async function act(action: MemoryNodeAction): Promise<MemoryNodeState> {
    if (!ops.supported || action === "status") return state;
    if (pending) {
      if (action === "open") await pending;
      return state;
    }
    if (action === "install" && state._tag !== "not-installed") return state;
    if (action === "start" && state._tag !== "not-running") return state;
    pending = perform(action)
      .then((next) => {
        state = next;
      })
      .catch((error: unknown) => {
        state = {
          _tag: "failed",
          reason: error instanceof Error ? error.message : "RivetHub could not be opened.",
        };
      })
      .finally(() => {
        pending = undefined;
      });
    if (action === "open" && state._tag === "checking") await pending;
    return state;
  }

  return {
    act,
    origin: () => origin,
    async link(raw: string) {
      if (!ops.supported || !loopbackHttpUrl(raw)) return null;
      if (!origin) await act("open");
      return origin ? memoryLinkPath(origin, raw) : null;
    },
    async relogin(expectedOrigin: string) {
      if (!origin || origin !== expectedOrigin) return null;
      try {
        const rh = await ops.find();
        const login = rh && parseLoginUrl(await ops.login(rh));
        return login && login.url.origin === expectedOrigin ? login.code : null;
      } catch {
        return null;
      }
    },
  };
}
