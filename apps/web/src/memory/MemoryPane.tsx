import {
  MEMORY_INSTALL_COMMAND,
  MEMORY_PARTITION,
  memoryLinkPath,
  memoryPageUrl,
  type MemoryNodeAction,
  type MemoryNodeState,
} from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import * as Schema from "effect/Schema";

import { Button } from "../components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../components/ui/empty";
import { useStableCallback } from "../hooks/useStableCallback";
import { useMemorySession } from "./useMemorySession";

const requestId = Schema.is(Schema.String.check(Schema.isPattern(/^[0-9a-f-]{36}$/u)));

function MemoryGuest({
  state,
  path,
  onFailure,
}: {
  state: Extract<MemoryNodeState, { _tag: "ready" }>;
  path: string;
  onFailure: () => void;
}) {
  const navigate = useNavigate();
  const openSession = useMemorySession();
  const receiveRequest = async (webview: HTMLElementTagNameMap["webview"], event: Event) => {
    const { channel, args } = event as Event & { channel?: string; args?: unknown[] };
    if (channel !== "rivethub-memory:request" || !args) return;
    const [id, kind, payload] = args;
    if (!requestId(id) || memoryLinkPath(state.origin, webview.getURL()) === null) return;
    if (kind === "relogin") {
      const code = await window.desktopBridge?.memory?.relogin(state.origin).catch(() => null);
      if (webview.isConnected) await webview.send("rivethub-memory:reply", id, code ?? null);
      return;
    }
    if (kind !== "open-session") return;
    const opened = await openSession(payload);
    if (!webview.isConnected) return;
    await webview.send("rivethub-memory:reply", id, opened.result);
    if (opened.destination) void navigate(opened.destination);
  };
  const attach = useStableCallback((webview: HTMLElementTagNameMap["webview"] | null) => {
    if (!webview) return;
    const destination = memoryPageUrl(state.origin, path);
    let signedIn = false;
    const onNavigate = (event: Event) => {
      const { url } = event as Event & { url: string };
      const next = URL.parse(url);
      if (!signedIn && next?.origin === state.origin && next.pathname !== "/login") {
        signedIn = true;
        if (destination !== next.href) void webview.loadURL(destination).catch(() => {});
      }
    };
    const onLoadFailure = (event: Event) => {
      const details = event as Event & { errorCode: number; isMainFrame: boolean };
      if (details.isMainFrame && details.errorCode !== -3) onFailure();
    };
    const onRequest = (event: Event) => {
      void receiveRequest(webview, event).catch(() => {});
    };
    webview.addEventListener("did-navigate", onNavigate);
    webview.addEventListener("did-fail-load", onLoadFailure);
    webview.addEventListener("render-process-gone", onFailure);
    webview.addEventListener("ipc-message", onRequest);
    return () => {
      webview.removeEventListener("did-navigate", onNavigate);
      webview.removeEventListener("did-fail-load", onLoadFailure);
      webview.removeEventListener("render-process-gone", onFailure);
      webview.removeEventListener("ipc-message", onRequest);
    };
  });
  return (
    <webview
      ref={attach}
      src={state.signedInUrl}
      partition={MEMORY_PARTITION}
      className="h-full min-h-0 w-full flex-1"
      aria-label="RivetHub Memory"
    />
  );
}

export function MemoryPane({ path = "/" }: { path?: string }) {
  const bridge = window.desktopBridge?.memory;
  const [state, setState] = useState<MemoryNodeState>({ _tag: "checking" });
  const run = useStableCallback(async (action: MemoryNodeAction) => {
    if (!bridge) return;
    try {
      setState(await bridge.node(action));
    } catch {
      setState({ _tag: "failed", reason: "T3.1 Code could not check RivetHub. Try again." });
    }
  });
  const onFailure = useStableCallback(() =>
    setState({
      _tag: "failed",
      reason: "The RivetHub page could not be loaded. Check rh status and try again.",
    }),
  );

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- queries desktop main when opening the view or following a new link
  useEffect(() => {
    if (!bridge) return;
    let live = true;
    void bridge.node("open").then(
      (next) => {
        if (live) setState(next);
      },
      () => {
        if (live) onFailure();
      },
    );
    return () => {
      live = false;
    };
  }, [bridge, onFailure]);

  const busy = state._tag === "installing" || state._tag === "starting";
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- reads installer output or startup status from desktop main
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => void run("status"), 250);
    return () => clearInterval(timer);
  }, [busy, run]);

  if (!bridge) return <MemoryStatus title="Memory is available in the T3.1 Code desktop app" />;
  switch (state._tag) {
    case "unsupported":
      return <MemoryStatus title="Memory requires Linux or macOS" />;
    case "checking":
      return <MemoryStatus title="Checking RivetHub…" />;
    case "not-installed":
      return (
        <MemoryStatus
          title="Install RivetHub"
          description="Run the official installer to set up Memory on this computer."
        >
          <code className="block select-all wrap-anywhere rounded-md bg-muted p-2 text-xs">
            {MEMORY_INSTALL_COMMAND}
          </code>
          <Button onClick={() => void run("install")}>Install RivetHub</Button>
        </MemoryStatus>
      );
    case "installing":
      return (
        <MemoryStatus title="Installing RivetHub…">
          <pre
            className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-2 text-start text-xs"
            aria-label="Installer output"
          >
            {state.output}
          </pre>
        </MemoryStatus>
      );
    case "not-running":
      return (
        <MemoryStatus title="RivetHub is stopped">
          <Button onClick={() => void run("start")}>Start RivetHub</Button>
        </MemoryStatus>
      );
    case "starting":
      return <MemoryStatus title="Starting RivetHub…" />;
    case "no-ui":
      return (
        <MemoryStatus
          title="The RivetHub web app is missing"
          description="Run rh update in a terminal, then check again."
        >
          <Button variant="outline" onClick={() => void run("open")}>
            Check again
          </Button>
        </MemoryStatus>
      );
    case "failed":
      return (
        <MemoryStatus title="Could not open RivetHub" description={state.reason}>
          <Button variant="outline" onClick={() => void run("open")}>
            Try again
          </Button>
        </MemoryStatus>
      );
    case "ready":
      return <MemoryGuest state={state} path={path} onFailure={onFailure} />;
  }
}

function MemoryStatus({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <Empty className="min-h-0 flex-1 overflow-auto">
      <EmptyHeader className="max-w-xl">
        <EmptyTitle>{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
      {children ? (
        <div className="flex max-w-full flex-col items-center gap-3">{children}</div>
      ) : null}
    </Empty>
  );
}
