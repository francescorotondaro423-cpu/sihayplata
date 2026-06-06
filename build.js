'use strict';

const fs   = require('fs');
const path = require('path');
const babel = require('@babel/core');

const SRC     = path.join(__dirname, 'public', 'index.html');
const OUT_DIR = path.join(__dirname, 'dist');
const OUT     = path.join(OUT_DIR, 'index.html');

const t0 = Date.now();
console.log('[build] Leyendo public/index.html…');

let html = fs.readFileSync(SRC, 'utf8');

// Extraer JSX del bloque <script type="text/babel">
const scriptRe = /<script type="text\/babel">([\s\S]*?)<\/script>/;
const match = scriptRe.exec(html);
if (!match) {
  console.error('[build] ERROR: No se encontró <script type="text/babel">');
  process.exit(1);
}

const jsx = match[1];
console.log(`[build] JSX extraído: ${(jsx.length / 1024).toFixed(0)} KB`);

// Compilar JSX → JS puro (sin Babel en el browser)
console.log('[build] Compilando JSX con @babel/preset-react…');
const result = babel.transformSync(jsx, {
  presets: [['@babel/preset-react', { runtime: 'classic' }]],
  compact: true,
  comments: false,
  sourceMaps: false,
});

console.log(`[build] Compilado: ${(result.code.length / 1024).toFixed(0)} KB`);

// Reemplazar el bloque JSX con JS compilado
// Usamos función en replace() para evitar que los $ del código compilado
// sean interpretados como patrones especiales ($&, $', $`, $n)
const compiledCode = result.code;
let compiled = html
  .replace(scriptRe, () => `<script>\n${compiledCode}\n</script>`)
  // Quitar Babel Standalone del CDN (ya no necesario)
  .replace(/\n?\s*<script src="https:\/\/unpkg\.com\/@babel\/standalone\/babel\.min\.js"[^>]*><\/script>/g, '');

// Crear dist/ y escribir
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// Copiar assets estáticos referenciados (sw.js, favicon, etc.) al mismo público
// El servidor seguirá sirviendo /public para assets; solo index.html va a dist/
fs.writeFileSync(OUT, compiled, 'utf8');

const ms = Date.now() - t0;
const inKB  = (html.length     / 1024).toFixed(0);
const outKB = (compiled.length / 1024).toFixed(0);
console.log(`[build] ✓ dist/index.html generado en ${ms}ms`);
console.log(`[build]   Entrada: ${inKB} KB → Salida: ${outKB} KB (Babel eliminado del bundle)`);
