import { forwardApiRequest } from "@laxdb/frontend/api";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/report-images/$id")({
  server: {
    handlers: {
      ANY: ({ request }) => forwardApiRequest(request),
    },
  },
});
