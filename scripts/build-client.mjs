#!/usr/bin/env node
/**
 * Build the dsh-flow-canvas client bundle.
 *
 * Produces lib/client.js in the DSH __ModuleLoader__ format.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const MANIFEST = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const PLUGIN_ID = MANIFEST.name

console.log(`[dsh-flow-canvas] Building client bundle for ${PLUGIN_ID}...`)

// Create a minimal client entry that registers a tab
const clientEntry = join(ROOT, 'src', 'client', 'entry.ts')
const clientDir = join(ROOT, 'src', 'client')
mkdirSync(clientDir, { recursive: true })

// Write the client entry
writeFileSync(clientEntry, `
// dsh-flow-canvas client entry — registers the Flow Canvas tab
import { createElement } from 'react'

export const inject = ['@deepseek-ai/dsh-client-runtime', '@deepseek-ai/dsh-client-ui-conversation/client']

export function apply(ctx) {
  // Register a conversation view tab
  ctx.slot('conversation.view', () => ({
    id: 'flow-canvas',
    label: 'Flow Canvas',
    icon: '🚀',
    order: 100,
    render: () => createElement('div', { 
      style: { padding: '20px', fontFamily: 'system-ui' } 
    }, 
      createElement('h2', null, '🚀 Flow Canvas'),
      createElement('p', null, 'Visual workflow editor — coming soon'),
      createElement('div', { style: { marginTop: '20px', padding: '16px', background: '#f5f5f5', borderRadius: '8px' } },
        createElement('p', null, 'Create agent workflows as a DAG:'),
        createElement('code', null, 'Start → Agent → Condition → Agent → End'),
        createElement('br'),
        createElement('br'),
        createElement('p', null, 'Use the flow_canvas tool in chat to get started.')
      )
    )
  }))
  
  console.log('[dsh-flow-canvas] Client tab registered.')
}

export const name = '${PLUGIN_ID}'
`)

// Use esbuild to bundle
const EXTERNALS = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client',
  'cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-web-react', 
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-runtime/client',
  '@deepseek-ai/dsh-client-ui-conversation/client',
  '@deepseek-ai/dsh-client-locale/client',
]

const banner = `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {
var module = { exports: {} }; var exports = module.exports;`
const footer = `return module.exports; } });`

try {
  execSync(`npx esbuild ${clientEntry} --outfile=${join(ROOT, 'lib', 'client.js')} --bundle --format=cjs --platform=browser --target=es2022 --external:${EXTERNALS.join(' --external:')} --define:process.env.NODE_ENV=\\"production\\" --define:import.meta.env.MODE=\\"production\\" --banner:js="${banner.replace(/"/g, '\\\"')}" --footer:js="${footer.replace(/"/g, '\\\"')}"`, {
    cwd: ROOT,
    stdio: 'inherit'
  })
  console.log('[dsh-flow-canvas] lib/client.js built successfully')
} catch (e) {
  console.error('[dsh-flow-canvas] Build failed:', e.message)
  process.exit(1)
}
