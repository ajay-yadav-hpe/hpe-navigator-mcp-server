import { createWriteStream, mkdirSync } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { join, basename, resolve, normalize } from 'node:path'
import type { NavigatorConfig } from '../config.js'
import { AuthManager } from './auth.js'

export class ExtractionClient {
  private auth: AuthManager
  private baseUrl: string
  private downloadTimeoutMs: number
  private downloadDir: string
  private maxDownloadSizeBytes: number

  constructor(config: NavigatorConfig) {
    this.auth = new AuthManager(config)
    this.baseUrl = config.extractionBaseUrl
    this.downloadTimeoutMs = config.downloadTimeoutMs
    this.downloadDir = config.downloadDir
    this.maxDownloadSizeBytes = config.maxDownloadSizeMb * 1024 * 1024
  }

  async downloadBundle(
    bucket: string,
    path: string,
    outputFilename?: string,
  ): Promise<{ localPath: string; size: number }> {
    const token = await this.auth.getToken()

    const url = `${this.baseUrl}/extraction/v1/download?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(this.downloadTimeoutMs),
    })

    if (!res.ok) {
      throw new Error(`Download failed: ${res.status} ${res.statusText}`)
    }

    const contentLength = parseInt(res.headers.get('content-length') ?? '0', 10)
    if (contentLength > this.maxDownloadSizeBytes) {
      throw new Error(
        `File too large: ${(contentLength / 1024 / 1024).toFixed(1)}MB exceeds limit of ${this.maxDownloadSizeBytes / 1024 / 1024}MB`,
      )
    }

    const filename = outputFilename ?? basename(path)
    // Prevent directory traversal
    const safeFilename = basename(filename)
    const resolvedDir = resolve(this.downloadDir)
    mkdirSync(resolvedDir, { recursive: true })
    const localPath = join(resolvedDir, safeFilename)

    // Verify the output path is within the download directory
    // (redundant after basename() but kept as defence-in-depth)
    const normalizedPath = normalize(localPath)
    /* v8 ignore next 3 */
    if (!normalizedPath.startsWith(resolvedDir)) {
      throw new Error('Invalid filename: path traversal detected')
    }

    if (!res.body) {
      throw new Error('Response body is empty')
    }

    const nodeStream = Readable.fromWeb(res.body as import('stream/web').ReadableStream)
    const writeStream = createWriteStream(localPath)
    await pipeline(nodeStream, writeStream)

    const { statSync } = await import('node:fs')
    const stats = statSync(localPath)
    return { localPath, size: stats.size }
  }
}
