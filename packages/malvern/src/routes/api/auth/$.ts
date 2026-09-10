import { forwardApiRequest } from "@laxdb/frontend/api";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      ANY: ({ request }) => forwardApiRequest(request),
    },
  },
});
