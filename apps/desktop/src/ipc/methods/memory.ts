import { MEMORY_LINK_CHANNEL, MEMORY_NODE_CHANNEL, MEMORY_RELOGIN_CHANNEL } from "../channels.ts";
import { MemoryNodeAction, MemoryNodeState } from "@t3tools/contracts";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { makeDesktopMemory } from "../../memory/DesktopMemory.ts";
import * as DesktopIpc from "../DesktopIpc.ts";

let memory: ReturnType<typeof makeDesktopMemory> | undefined;
export const getMemoryOrigin = () => memory?.origin() ?? null;

const urlText = Schema.String.check(Schema.isMaxLength(16384));

export const installMemoryIpc = Effect.fn("desktop.ipc.installMemory")(function* () {
  const node = makeDesktopMemory(
    yield* HostProcess.Platform,
    yield* HostProcess.HomeDirectory,
    yield* HostProcess.Environment,
  );
  memory = node;
  const ipc = yield* DesktopIpc.DesktopIpc;
  yield* ipc.handle(
    DesktopIpc.makeIpcMethod({
      channel: MEMORY_NODE_CHANNEL,
      payload: MemoryNodeAction,
      result: MemoryNodeState,
      handler: (action) => Effect.promise(() => node.act(action)),
    }),
  );
  yield* ipc.handle(
    DesktopIpc.makeIpcMethod({
      channel: MEMORY_LINK_CHANNEL,
      payload: urlText,
      result: Schema.NullOr(Schema.String),
      handler: (url) => Effect.promise(() => node.link(url)),
    }),
  );
  yield* ipc.handle(
    DesktopIpc.makeIpcMethod({
      channel: MEMORY_RELOGIN_CHANNEL,
      payload: urlText,
      result: Schema.NullOr(Schema.String),
      handler: (origin) => Effect.promise(() => node.relogin(origin)),
    }),
  );
});
