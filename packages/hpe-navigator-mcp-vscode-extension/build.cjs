const esbuild = require('esbuild')
const path = require('path')
const fs = require('fs')

// 1. Bundle the extension host (CJS, vscode external)
esbuild.buildSync({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  platform: 'node',
  format: 'cjs',
  sourcemap: true,
})

// 2. Bundle the MCP server (CJS — NOT ESM) into dist/server/
esbuild.buildSync({
  entryPoints: [path.resolve(__dirname, '../hpe-navigator-mcp-server/src/index.ts')],
  bundle: true,
  outfile: 'dist/server/index.js',
  platform: 'node',
  format: 'cjs',
  sourcemap: true,
})

// 3. Strip shebang — esbuild CJS prepends "use strict"; BEFORE the shebang,
// so content.startsWith('#!') is WRONG. Use a regex that handles line 1 or 2.
const serverFile = path.resolve(__dirname, 'dist/server/index.js')
let content = fs.readFileSync(serverFile, 'utf8')
content = content.replace(/^(?:[^\n]*\n)?#![^\n]*\n/, '')
fs.writeFileSync(serverFile, content)

// 4. Copy root LICENSE into extension dir (required by @vscode/vsce)
const rootLicense = path.resolve(__dirname, '../../LICENSE')
const extLicense = path.resolve(__dirname, 'LICENSE')
if (fs.existsSync(rootLicense)) {
  fs.copyFileSync(rootLicense, extLicense)
}

console.log('✅ Extension and server bundled successfully')
