import type { NavigatorConfig } from '../config.js'
import { AuthManager } from './auth.js'

export class NavigatorClient {
  private auth: AuthManager
  private baseUrl: string
  private timeoutMs: number

  constructor(config: NavigatorConfig) {
    this.auth = new AuthManager(config)
    this.baseUrl = config.cxoBaseUrl
    this.timeoutMs = config.timeoutMs
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await this.auth.getToken()
    const url = `${this.baseUrl}${path}`

    const res = await this.fetchWithRetry(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    })

    if (res.status === 401) {
      this.auth.clearToken()
      const newToken = await this.auth.getToken()
      const retryRes = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${newToken}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      })
      if (!retryRes.ok) {
        throw new Error(`API error: ${retryRes.status} ${retryRes.statusText}`)
      }
      return retryRes.json() as Promise<T>
    }

    if (!res.ok) {
      throw new Error(`API error: ${res.status} ${res.statusText}`)
    }

    return res.json() as Promise<T>
  }

  private async fetchWithRetry(url: string, init: RequestInit, retries = 3): Promise<Response> {
    let lastError: Error | undefined
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const res = await fetch(url, init)
        if (res.status === 429) {
          const retryAfter = parseInt(res.headers.get('retry-after') ?? '2', 10)
          await sleep(retryAfter * 1000 * (attempt + 1))
          continue
        }
        return res
      } catch (err) {
        const cause = err instanceof Error ? (err as Error & { cause?: unknown }).cause : undefined
        const detail = cause instanceof Error ? `: ${cause.message}` : ''
        const hostname = (() => {
          try {
            return new URL(url).hostname
          } catch {
            return url
          }
        })()
        lastError = new Error(
          `Network error reaching ${hostname}${detail}. ` +
            `Ensure HPE VPN is active. ` +
            `If certificate errors occur, set HPE_NAV_TLS_REJECT_UNAUTHORIZED=false in extension settings.`,
        )
        if (attempt < retries - 1) {
          await sleep(1000 * Math.pow(2, attempt))
        }
      }
    }
    throw lastError ?? new Error('Request failed after retries')
  }

  async findSerial(serial: string) {
    return this.request<{ data: FindResult[]; total: number }>(`/query/v1/find`, {
      method: 'POST',
      body: JSON.stringify({ serial }),
    })
  }

  async getRelated(product: string, serial: string) {
    return this.request<{ data: RelatedProducts }>(
      `/query/v1/${encodeURIComponent(product)}/${encodeURIComponent(serial)}/related`,
    )
  }

  async getSfdcAsset(serial: string) {
    return this.request<{ data: SfdcAsset }>(`/query/v1/sfdc/assets/${encodeURIComponent(serial)}`)
  }

  async getFeed(product: string, serial: string) {
    return this.request<{ data: FeedAlert[] }>(
      `/query/v1/${encodeURIComponent(product)}/${encodeURIComponent(serial)}/feed`,
    )
  }

  async getOverview(product: string, serial: string) {
    return this.request<{ data: SystemOverview }>(
      `/query/v1/${encodeURIComponent(product)}/${encodeURIComponent(serial)}/overview`,
    )
  }

  async getHeartbeat(product: string, serial: string, heartbeatId: number) {
    return this.request<{ data: Record<string, unknown> }>(
      `/query/v1/${encodeURIComponent(product)}/${encodeURIComponent(serial)}/heartbeat/${heartbeatId}`,
    )
  }

  async listFiletypes(product: string) {
    return this.request<{ data: FileType[] }>(`/query/v1/${encodeURIComponent(product)}/filetypes`)
  }

  async listBundles(
    product: string,
    serial: string,
    fromTs: string,
    toTs: string,
    type?: string,
    latest?: boolean,
  ) {
    const params = new URLSearchParams({ from: fromTs, to: toTs })
    if (type) params.set('type', type)
    if (latest) params.set('latest', 'true')
    return this.request<{ data: Bundle[] }>(
      `/query/v1/${encodeURIComponent(product)}/${encodeURIComponent(serial)}/bundles?${params}`,
    )
  }

  async searchDashboards(tag: string) {
    return this.request<Dashboard[]>(
      `/query/v1/analytics/dashboards?tag=${encodeURIComponent(tag)}`,
    )
  }
}

export interface FindResult {
  matching_serial: string
  serial: string
  product: string
  model: string
  customer: string | null
  status: string
  component: string | null
}

export interface RelatedProducts {
  solution: string
  related_products: Array<{
    serial: string
    category: string
    product: string
  }>
}

export interface SfdcAsset {
  asset_id: string
  name?: string
  serial: string
  status: string
  install_date: string | null
  ship_date: string | null
  return_date?: string | null
  purchase_date?: string | null
  order_type?: string
  product: string
  product_family: string
  program?: string
  asset_type?: string
  product_name?: string
  product_description: string
  product_code: string
  sla: string
  hpe_sla: string
  support_start_date?: string | null
  support_end_date: string | null
  end_of_support_date?: string | null
  support_term_remaining_days: number | null
  is_escalated: boolean
  account: Record<string, unknown>
  contact: Record<string, unknown>
  open_cases: SfdcCase[]
  closed_cases: SfdcCase[]
  escalations: Escalation[]
  [key: string]: unknown
}

export interface SfdcCase {
  case_number: string
  subject: string
  status: string
  priority: string
  severity: string
  created_date: string
  escalation: {
    first_eng_esc_jira: string | null
    max_eng_esc_pri: string | null
  }
}

export interface Escalation {
  case_number: string
  jira_id: string
  priority: string
  jira_link: string
  targets: string[]
}

export interface FeedAlert {
  category: string
  severity: 'critical' | 'warning' | 'info'
  message: string
}

export interface SystemOverview {
  filedatetime?: string
  product?: string
  persona?: string
  platform?: string
  model?: string
  state?: string
  status?: string
  hostname?: string
  connection_state?: string
  software_version?: string
  infosight_enabled?: boolean
  display_name?: string
  version?: { os: string; upgrade_tool: string }
  system_model?: string
  node_count?: number
  pd_count?: number
  cage_count?: number
  maintenance_mode?: boolean
  space?: {
    total: number
    free: number
    raw_space_capacity_percent: number
  }
  rda_info?: Record<string, unknown>
  [key: string]: unknown
}

export interface Bundle {
  filedatetime: string
  scalitydatetime?: string
  type: string
  path: string
  bucket: string
  size: number
  metadata_hash?: string
}

export interface FileType {
  filetype: string
  indexed: boolean
  single: boolean
}

export interface Dashboard {
  id: number
  uid: string
  title: string
  url: string
  tags: string[]
  folderTitle: string
  folderUrl?: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
