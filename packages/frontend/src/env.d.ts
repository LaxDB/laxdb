/** Shared server transport contract; both apps bind their API Worker as API. */
declare namespace Cloudflare {
  interface Env {
    readonly API: {
      readonly fetch: (request: Request) => Promise<Response>;
    };
  }
}

// Keep frontend type checks independent of Workers global types.
declare module "cloudflare:workers" {
  export const env: Cloudflare.Env;
}
