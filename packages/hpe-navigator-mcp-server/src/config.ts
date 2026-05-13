import { z } from 'zod'

const configSchema = z.object({
  username: z.string().default(''),
  password: z.string().default(''),
  serviceToken: z.string().optional(),
  cxoBaseUrl: z.string().url().default('https://web.service.cxo.suptools.hpecorp.net'),
  extractionBaseUrl: z
    .string()
    .url()
    .default('https://extraction.service.cxo.suptools.hpecorp.net'),
  oktaClientId: z.string().default('0oa122o4eogCUhWbH698'),
  oktaAuthorizeUrl: z
    .string()
    .url()
    .default('https://mylogin.hpe.com/oauth2/aus5016946Vxb1HI6697/v1/authorize'),
  oktaTokenUrl: z
    .string()
    .url()
    .default('https://mylogin.hpe.com/oauth2/aus5016946Vxb1HI6697/v1/token'),
  oktaRedirectUri: z
    .string()
    .url()
    .default('https://navigator.service.suptools.hpecorp.net/oidc/callback'),
  callbackPort: z.coerce.number().int().min(0).default(0),
  tokenRefreshBufferMs: z.coerce.number().int().positive().default(300_000),
  timeoutMs: z.coerce.number().int().positive().default(30_000),
  downloadTimeoutMs: z.coerce.number().int().positive().default(600_000),
  downloadDir: z.string().default('./downloads'),
  maxDownloadSizeMb: z.coerce.number().positive().default(500),
})

export type NavigatorConfig = z.infer<typeof configSchema>

export function loadConfig(): NavigatorConfig {
  const env = process.env
  return configSchema.parse({
    username: env.HPE_NAV_USERNAME,
    password: env.HPE_NAV_PASSWORD,
    serviceToken: env.HPE_NAV_SERVICE_TOKEN || undefined,
    cxoBaseUrl: env.HPE_NAV_CXO_BASE_URL,
    extractionBaseUrl: env.HPE_NAV_EXTRACTION_BASE_URL,
    oktaClientId: env.HPE_NAV_OKTA_CLIENT_ID,
    oktaAuthorizeUrl: env.HPE_NAV_OKTA_AUTHORIZE_URL,
    oktaTokenUrl: env.HPE_NAV_OKTA_TOKEN_URL,
    oktaRedirectUri: env.HPE_NAV_OKTA_REDIRECT_URI,
    callbackPort: env.HPE_NAV_CALLBACK_PORT,
    tokenRefreshBufferMs: env.HPE_NAV_TOKEN_REFRESH_BUFFER_MS,
    timeoutMs: env.HPE_NAV_TIMEOUT_MS,
    downloadTimeoutMs: env.HPE_NAV_DOWNLOAD_TIMEOUT_MS,
    downloadDir: env.HPE_NAV_DOWNLOAD_DIR,
    maxDownloadSizeMb: env.HPE_NAV_MAX_DOWNLOAD_SIZE_MB,
  })
}
