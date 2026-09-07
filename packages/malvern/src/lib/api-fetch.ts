import { Effect } from "effect";

type ApiServiceBinding = {
  readonly fetch: (request: Request) => Promise<Response>;
};

type CloudflareWorkersModule = {
  readonly env: { readonly API: ApiServiceBinding };
};

const isCloudflareWorkersModule = (
  value: unknown,
): value is CloudflareWorkersModule => {
  if (typeof value !== "object" || value === null || !("env" in value)) {
    return false;
  }
  const env = value.env;
  return (
    typeof env === "object" &&
    env !== null &&
    "API" in env &&
    typeof env.API === "object" &&
    env.API !== null &&
    "fetch" in env.API &&
    typeof env.API.fetch === "function"
  );
};

export const localApiUrl = `http://localhost:${process.env.API_PORT ?? "1437"}`;
export const apiUrl =
  process.env.IS_LOCAL === "true" ? localApiUrl : "http://api";

const loadApiBinding = Effect.promise(async () => {
  // oxlint-disable-next-line no-useless-concat -- A static specifier makes Vite resolve this worker runtime module at build time.
  const workerModule = "cloudflare:" + "workers";
  const workers: unknown = await import(/* @vite-ignore */ workerModule);
  if (!isCloudflareWorkersModule(workers)) {
    throw new TypeError("Cloudflare workers module is missing the API binding");
  }
  return workers.env.API;
});

export const fetchApi = (request: Request) =>
  request.url.startsWith(localApiUrl)
    ? fetch(request)
    : Effect.runPromise(loadApiBinding).then((api) => api.fetch(request));
