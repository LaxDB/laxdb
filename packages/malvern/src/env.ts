import * as cf from "cloudflare:workers";

type MalvernEnv = {
  readonly API: Fetcher;
  readonly IS_LOCAL?: string;
};

// TanStack Start dev can evaluate route modules before `cloudflare:workers`
// exposes env. Read through a proxy so server handlers always see the current
// worker env at request time.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Cloudflare's ambient Env omits generated worker bindings.
export const env = new Proxy({} as MalvernEnv, {
  get(_, prop) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Proxy keys are forwarded to the current Cloudflare environment.
    return cf.env[prop as keyof typeof cf.env];
  },
});
