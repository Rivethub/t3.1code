import { createFileRoute } from "@tanstack/react-router";

import { MemoryPane } from "../memory/MemoryPane";

export const Route = createFileRoute("/_chat/settings/memory")({
  component: () => <MemoryPane path="/settings" />,
});
