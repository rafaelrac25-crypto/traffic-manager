/* eslint-disable no-console */
/**
 * Captura full-page screenshots de todas as rotas do AdManager em produção.
 * Output: .design/atual/<rota>--<modo>.png
 *
 * Uso:
 *   cd traffic-manager
 *   node .design/scripts/capture.js
 *
 * Pré-requisito: chromium instalado (npx playwright install chromium).
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.env.BASE_URL || 'https://criscosta.vercel.app';
const OUT_DIR = path.join(__dirname, '..', 'atual');

const ROUTES = [
  { path: '/',              name: 'dashboard' },
  { path: '/anuncios',      name: 'campanhas' },
  { path: '/campanhas-v2',  name: 'campanhas-hierarquia' },
  { path: '/relatorios',    name: 'relatorios' },
  { path: '/reprovados',    name: 'reprovados' },
  { path: '/calendario',    name: 'calendario' },
  { path: '/investimento',  name: 'investimento' },
  { path: '/publicos',      name: 'publicos' },
  { path: '/criativos',     name: 'biblioteca-criativos' },
  { path: '/referencias',   name: 'referencias' },
  { path: '/criar-anuncio', name: 'criar-anuncio' },
  { path: '/historico',     name: 'historico' },
];

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2, /* prints retina pra qualidade na referência */
  });
  const page = await ctx.newPage();

  /* Tema light por padrão (sistema persiste em localStorage). */
  await page.goto(BASE);
  await page.evaluate(() => {
    try { localStorage.setItem('theme', 'light'); } catch {}
  });

  for (const r of ROUTES) {
    const url = `${BASE}${r.path}`;
    process.stdout.write(`[capture] ${r.name.padEnd(28)} `);
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1500); /* deixa animações/skeletons assentarem */
      const file = path.join(OUT_DIR, `${r.name}--light.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log('OK light');
    } catch (e) {
      console.log('FAIL light:', e.message);
    }
  }

  /* Segunda passada em dark mode */
  await page.evaluate(() => {
    try { localStorage.setItem('theme', 'dark'); } catch {}
  });

  for (const r of ROUTES) {
    const url = `${BASE}${r.path}`;
    process.stdout.write(`[capture] ${r.name.padEnd(28)} `);
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1500);
      const file = path.join(OUT_DIR, `${r.name}--dark.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log('OK dark');
    } catch (e) {
      console.log('FAIL dark:', e.message);
    }
  }

  /* Mobile preview de 4 telas-chave (homepage, campanhas, criativos, criar-anuncio) */
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 }, /* iPhone 14 */
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const mobile = await mobileCtx.newPage();
  await mobile.goto(BASE);
  await mobile.evaluate(() => {
    try { localStorage.setItem('theme', 'light'); } catch {}
  });

  const MOBILE_ROUTES = ROUTES.filter(r => ['dashboard', 'campanhas', 'biblioteca-criativos', 'criar-anuncio'].includes(r.name));
  for (const r of MOBILE_ROUTES) {
    process.stdout.write(`[capture] ${r.name.padEnd(28)} `);
    try {
      await mobile.goto(`${BASE}${r.path}`, { waitUntil: 'networkidle', timeout: 30000 });
      await mobile.waitForTimeout(1500);
      const file = path.join(OUT_DIR, `${r.name}--mobile.png`);
      await mobile.screenshot({ path: file, fullPage: true });
      console.log('OK mobile');
    } catch (e) {
      console.log('FAIL mobile:', e.message);
    }
  }

  await browser.close();
  console.log('\n[capture] Todos os prints em', OUT_DIR);
}

main().catch(e => { console.error(e); process.exit(1); });
