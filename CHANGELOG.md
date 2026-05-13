# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-05-13

### Added

- **MCP Server** with 12 tools for HPE Navigator integration
  - `navigator_find_serial` — Serial number lookup
  - `navigator_get_related` — Related products in a solution
  - `navigator_get_sfdc_asset` — Salesforce asset details (SLA, cases, escalations)
  - `navigator_get_feed` — System status feed/alerts
  - `navigator_get_overview` — System overview (health, capacity, hardware)
  - `navigator_get_heartbeat` — Detailed heartbeat telemetry
  - `navigator_list_filetypes` — Available telemetry file types
  - `navigator_list_bundles` — Telemetry bundles by date range
  - `navigator_download_bundle` — Download telemetry bundle files
  - `navigator_search_dashboards` — Search analytics dashboards
  - `navigator_get_system_summary` — Composite triage summary
  - `navigator_get_dscvm_logs` — DSCVM log retrieval workflow

- **Authentication** supporting three strategies:
  - Direct service token (headless, for CI/automation)
  - Username/password login (headless, for MCP servers)
  - Okta browser SSO with PKCE (interactive, for users)

- **VS Code Extension** with `mcpServerDefinitionProviders` registration
  - Configurable via VS Code settings UI
  - Supports all auth methods via settings

- **CI/CD Pipeline**
  - Lint (ESLint + TypeScript)
  - Format (Prettier)
  - Test with 90%+ coverage threshold (Vitest + v8)
  - Security audit (pnpm audit)
  - Build verification
  - GitHub Release workflow with VSIX artifact
  - npm publish for server package

- **Security**
  - Credentials from environment only, never logged
  - In-memory token caching with auto-refresh
  - PKCE flow for OAuth (RFC 7636)
  - File download sandboxing with path traversal prevention
  - Size limits on downloads
  - Input validation via Zod schemas
  - TLS enforcement for all API calls

### Security

- All API calls enforce HTTPS to `*.hpecorp.net` domains
- Download directory is sandboxed; path traversal is blocked
- JWT tokens decoded and auto-refreshed before expiry (5-min buffer)
- OAuth callback server binds to localhost only, ephemeral port, auto-shutdown
