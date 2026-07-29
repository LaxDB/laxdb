import { createFileRoute } from "@tanstack/react-router";

import { FormatPage } from "../pages/tournament-pages";

export const Route = createFileRoute("/format")({ component: FormatPage });
