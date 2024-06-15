import z from "zod";

const envSchema = z.object({
  PORT: z.string().default("3000"),
  SELF_URL: z.string().regex(/^(?!.*\/$).+$/, 'must not end with a "/"'),
  DATABASE_URL: z.string(),
  ENCRYPTION_KEY: z.string(),
  SLACK_TOKEN: z.string(),
  SLACK_SIGNING_SECRET: z.string(),
  SPOTIFY_CLIENT_ID: z.string(),
  SPOTIFY_CLIENT_SECRET: z.string(),
});
export default envSchema.parse(process.env);
