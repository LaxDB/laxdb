import { Config } from "effect";

export const AppConfig = Config.all({
  apiUrl: Config.String("API_URL"),

  googleClientId: Config.String("GOOGLE_CLIENT_ID"),
  googleClientSecret: Config.Redacted("GOOGLE_CLIENT_SECRET"),
  polarWebhookSecret: Config.Redacted("POLAR_WEBHOOK_SECRET"),

  alchemyPassword: Config.Redacted("ALCHEMY_PASSWORD"),
  alchemyStateToken: Config.Redacted("ALCHEMY_STATE_TOKEN"),

  cloudflareAccountId: Config.String("CLOUDFLARE_ACCOUNT_ID"),
  cloudflareApiToken: Config.Redacted("CLOUDFLARE_API_TOKEN"),
  cloudflareEmail: Config.String("CLOUDFLARE_EMAIL"),

  pllGraphqlToken: Config.Redacted("PLL_GRAPHQL_TOKEN"),
  pllRestToken: Config.Redacted("PLL_REST_TOKEN"),

  awsRegion: Config.String("AWS_REGION").pipe(Config.withDefault("us-west-2")),
  emailSender: Config.String("EMAIL_SENDER").pipe(
    Config.withDefault("noreply@laxdb.io"),
  ),
});

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
};

/**
 * Synchronous environment access for non-sensitive values only.
 *
 * WHY THIS EXISTS:
 * Effect Config (AppConfig) requires being inside an Effect context to access values.
 * However, some patterns like AtomHttpApi.Tag and AtomRpc.Tag need configuration at
 * module definition time (outside Effect context). This helper provides synchronous
 * access for those specific cases.
 *
 * SECURITY:
 * - Only non-sensitive values (public URLs) should be exposed here
 * - Secrets MUST use AppConfig with Config.Redacted() for proper redaction in logs
 * - If you need a secret synchronously, refactor to defer the access into Effect context
 */
export const Env = {
  API_URL: () => requireEnv("API_URL"),
} as const;
