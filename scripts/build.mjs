#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
console.log('[dsh-flow-canvas] Building...')

// ---- Server ----
const libDir = join(root, 'lib')
mkdirSync(libDir, { recursive: true })
const coreDir = join(root, 'src', 'core')

let serverOut = '// ===== Inlined core modules =====\n'
for (const f of ['nodes.cjs', 'compiler.cjs', 'engine.cjs']) {
  let src = readFileSync(join(coreDir, f), 'utf8')
  // Strip module.exports and require lines for ESM inlining
  src = src.replace(/^module\.exports\s*=\s*\{[^}]+\}/gm, '// exports inlined as global vars')
  src = src.replace(/const\s*\{[^}]+\}\s*=\s*require\([^)]+\)/g, '// require removed')
  serverOut += src + '\n\n'
}

let serverSrc = readFileSync(join(root, 'src', 'server', 'index.ts'), 'utf8')
// Remove require line (core vars are already global)
serverSrc = serverSrc.replace(/const \{ [^}]+\} = require\(['"]\.\/core\/index\.cjs['"]\)\n?/, '')
serverOut += '// ===== server/index.ts =====\n' + serverSrc
writeFileSync(join(libDir, 'index.js'), serverOut)
console.log('  lib/index.js (' + serverOut.split('\n').length + ' lines)')

// ---- Client ----
const BUNDLE_ID = 'dsh-flow-canvas'
const outfile = join(root, 'client', 'index.js')
execSync([
  'node', join(root, 'node_modules', 'esbuild', 'bin', 'esbuild'),
  join(root, 'src', 'client', 'entry.tsx'),
  '--bundle', '--format=cjs', '--platform=browser', `--outfile=${outfile}`,
  '--external:react', '--external:react/jsx-runtime', '--external:react-dom', '--external:react-dom/client',
  '--jsx=automatic', '--minify',
].join(' '), { stdio: 'inherit' })

let body = readFileSync(outfile, 'utf8')
const cssFile = outfile.replace(/\.js$/, '.css')
if (existsSync(cssFile)) {
  body = `if(typeof document!=='undefined'){var s=document.createElement('style');s.dataset.plugin='${BUNDLE_ID}';s.textContent=${JSON.stringify(readFileSync(cssFile,'utf8'))};document.head.appendChild(s)}\n` + body
  rmSync(cssFile)
}
writeFileSync(outfile, `if(typeof window!=='undefined'&&typeof window.__ModuleLoader__!=='undefined'){var factory=function(require){console.log('[dsh-flow-canvas] factory called');var module={exports:{}};var exports=module.exports;Object.defineProperty(exports,Symbol.toStringTag,{value:"Module"});
${body}
if(!module.exports.inject)module.exports.inject=['slots','settingsScope'];if(!module.exports.default)module.exports.default=module.exports.apply;if(!module.exports.default?.inject){var a=module.exports.default||module.exports.apply;if(a)module.exports.default=Object.assign(a,{inject:module.exports.inject})}return module.exports};window.__ModuleLoader__.load({id:'${BUNDLE_ID}/client',factory:factory});window.__ModuleLoader__.load({id:'${BUNDLE_ID}',factory:factory})}`)
console.log('  client/index.js (factory bundle)')
console.log('[dsh-flow-canvas] Build complete.')
