export interface FormattedToolResult {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

export function formatSuccess(data: unknown): FormattedToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  }
}

export function formatError(message: string): FormattedToolResult {
  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    isError: true,
  }
}
