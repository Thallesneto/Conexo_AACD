// Requer Playwright. CHROMIUM_PATH e PLAYWRIGHT_MODULE são opcionais.
// Execute: node --test tests/ux_writing_browser.mjs
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../frontend/', import.meta.url));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
let server, browser, url;
const vendor = new Map();

before(async () => {
  // As bibliotecas reais ficam em memória; não dependemos da rede do navegador.
  for (const asset of [
    'bootstrap@5.3.3/dist/css/bootstrap.min.css',
    'bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
    'leaflet@1.9.4/dist/leaflet.css',
    'leaflet@1.9.4/dist/leaflet.js'
  ]) {
    const address = 'https://cdn.jsdelivr.net/npm/' + asset;
    const response = await fetch(address, { signal: AbortSignal.timeout(20000) });
    assert.ok(response.ok, 'Não foi possível carregar ' + asset);
    vendor.set(address, { body: Buffer.from(await response.arrayBuffer()),
      contentType: asset.endsWith('.css') ? 'text/css' : 'text/javascript' });
  }
  server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!path.startsWith(resolve(root) + sep)) { response.writeHead(403).end(); return; }
    try {
      response.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream' });
      response.end(await readFile(path));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  url = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined });
});
after(async () => {
  await browser?.close();
  await new Promise(done => server ? server.close(done) : done());
});

const user = { id: '1', perfil: 'aacd', homologado: true, unidade: 'Mooca',
  nome: 'Equipe de teste', email: 'teste@example.org', telefone: '11999999999' };
const options = [1, 2].map(id => ({ partnerId: String(id), printerId: 'printer-' + id,
  name: 'Parceiro ' + id, location: 'São Paulo / SP', printerName: 'Impressora ' + id,
  material: 'PLA', nozzle: 0.4, distanceKm: id, needsMaterial: false }));
const order = { id: '9', id_solicitacao: '3', id_parceiro: '1', codigo: 'UX-001',
  status: 'pendente', prioridade: 'padrao', capacidade_x: 50, capacidade_y: 50,
  capacidade_z: 50, material: 'PLA', bico_mm: 0.4, unidade: 'Mooca',
  link: 'https://example.org/modelo.stl', snapshot: { lab: 'Parceiro 1' },
  atualizado_em: '2026-11-19T12:00:00.000Z' };
const until = async (check, message) => {
  const end = Date.now() + 6000;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise(done => setTimeout(done, 25));
  }
  throw new Error(message);
};
function gate() {
  let release;
  const promise = new Promise(done => { release = done; });
  return { promise, release };
}
async function fixture({ partner = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const state = { recommendations: options, recommendationGate: null,
    sendGate: null, sendStatus: 201, failListAfterSend: false, sent: false,
    posts: 0, recommendationPosts: 0, reads: 0, details: 0, payload: null, errors: [] };
  await context.route('https://cdn.jsdelivr.net/**', async route => {
    const asset = vendor.get(route.request().url());
    if (asset) await route.fulfill(asset); else await route.abort();
  });
  await context.route('https://cdn.userway.org/**', route => route.abort());
  await context.route('https://tile.openstreetmap.org/**', route => route.abort());
  await context.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname.slice(4);
    if (path === '/auth/me') {
      await route.fulfill({ json: { user: partner ? { ...user, perfil: 'parceiro' } : user } });
    } else if (path === '/auth/csrf') {
      await route.fulfill({ json: { csrfToken: 'teste' } });
    } else if (path === '/auth/logout') {
      await route.fulfill({ status: 204 });
    } else if (path === '/catalogos') {
      await route.fulfill({ json: { unidades: ['Mooca'] } });
    } else if (path === '/recomendacoes') {
      state.recommendationPosts++;
      if (state.recommendationGate) await state.recommendationGate.promise;
      await route.fulfill({ json: { items: state.recommendations } });
    } else if (path === '/pedidos' && request.method() === 'POST') {
      state.posts++;
      state.payload = request.postDataJSON();
      if (state.sendGate) await state.sendGate.promise;
      if (state.sendStatus === 'network') { await route.abort('failed'); return; }
      state.sent = state.sendStatus === 201;
      await route.fulfill({ status: state.sendStatus, json: state.sent
        ? { id: '9', status: 'pendente' }
        : { error: { message: 'Detalhe técnico indisponível', code: 'SERVER_ERROR' } } });
    } else if (path === '/pedidos') {
      state.reads++;
      if (state.sent && state.failListAfterSend) {
        await route.fulfill({ status: 503, json: { error: { message: 'Lista indisponível' } } });
      } else await route.fulfill({ json: { items: partner || state.sent ? [order] : [] } });
    } else if (path === '/pedidos/9') {
      state.details++;
      await route.fulfill({ status: 503, json: { error: { message: 'Leitura posterior indisponível' } } });
    } else if (path === '/me') {
      await route.fulfill({ json: { user } });
    } else {
      await route.fulfill({ json: { items: [] } });
    }
  });
  const page = await context.newPage();
  page.on('pageerror', error => state.errors.push(error.message));
  await page.goto(url + (partner ? '/#parceiro-pedidos' : '/#aacd-pedido-1'));
  await page.locator(partner ? '#parceiro-pedidos' : '#aacd-pedido-1').waitFor({ state: 'visible' });
  return { context, page, state };
}
async function draft(page) {
  await page.getByLabel('Código do pedido', { exact: true }).fill('UX-001');
  await page.locator('#aacd-order-step-1 [type=submit]').click();
  for (const axis of ['X', 'Y', 'Z']) await page.locator('#aacd-volume' + axis).fill('50');
  await page.locator('#aacd-order-step-2 [name=materials][value=PLA]').check();
  await page.locator('#aacd-order-step-2 [type=submit]').click();
  await page.getByLabel('Link do arquivo de impressão 3D', { exact: true }).fill(order.link);
}
async function matches(page) {
  await page.getByRole('button', { name: 'Escolher parceiro', exact: true }).click();
  await page.locator('#aacd-conectar').waitFor({ state: 'visible' });
}
async function snapshot(page, name) {
  if (!process.env.CONEXO_SCREENSHOT_DIR) return;
  await mkdir(process.env.CONEXO_SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: resolve(process.env.CONEXO_SCREENSHOT_DIR, name + '.png'), fullPage: true });
}

test('rótulos e estado vazio orientam a revisão sem perder os dados', async () => {
  const { context, page, state } = await fixture();
  try {
    await draft(page);
    assert.equal(await page.locator('#aacd-order-url').getAttribute('aria-describedby'), 'aacd-order-url-help');
    assert.match(await page.locator('#aacd-order-url-help').textContent(), /permissão para acessar/);
    assert.match(await page.locator('label[for=aacd-order-notes]').textContent(), /para o parceiro/);
    state.recommendations = [];
    await snapshot(page, 'arquivo-desktop');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await snapshot(page, 'arquivo-mobile');
    await matches(page);
    assert.match(await page.locator('#aacd-connect-feedback').textContent(), /Nenhum parceiro compatível encontrado/);
    const messageBox = await page.locator('#aacd-connect-feedback').boundingBox();
    const actionBox = await page.locator('#aacd-review-requirements').boundingBox();
    assert.ok(actionBox.y >= messageBox.y + messageBox.height, 'A ação não pode cobrir a orientação');
    await snapshot(page, 'sem-parceiros-mobile');
    await page.getByRole('link', { name: 'Revisar requisitos do pedido' }).click();
    await page.locator('#aacd-pedido-2').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#aacd-volumeX').inputValue(), '50');
    assert.equal(await page.locator('#aacd-order-url').inputValue(), order.link);
    assert.deepEqual(state.errors, []);
  } finally { await context.close(); }
});

test('busca anuncia progresso e ignora submissões repetidas', async () => {
  const { context, page, state } = await fixture();
  try {
    await draft(page);
    state.recommendationGate = gate();
    await page.getByRole('button', { name: 'Escolher parceiro', exact: true }).click();
    assert.ok(await page.getByRole('button', { name: 'Buscando parceiros…' }).isDisabled());
    assert.equal(await page.locator('#aacd-order-step-3').getAttribute('aria-busy'), 'true');
    assert.match(await page.locator('#aacd-recommendations-feedback').textContent(), /Buscando parceiros compatíveis/);
    await page.locator('#aacd-order-step-3').evaluate(form => form.requestSubmit());
    state.recommendationGate.release();
    await page.locator('#aacd-conectar').waitFor({ state: 'visible' });
    assert.equal(await page.locator('[data-connect-order]').count(), 2);
    assert.equal(state.recommendationPosts, 1);
    assert.equal(await page.locator('#aacd-order-step-3').getAttribute('aria-busy'), null);
    assert.deepEqual(state.errors, []);
  } finally { await context.close(); }
});

test('envio bloqueia todos os parceiros e confirma aguardando aceite', async () => {
  const { context, page, state } = await fixture();
  try {
    await draft(page); await matches(page);
    state.sendGate = gate();
    await page.locator('[data-connect-order]').first().click();
    await until(() => state.posts === 1, 'POST não iniciado');
    assert.equal(await page.locator('[data-connect-order]:disabled').count(), 2);
    assert.equal(await page.locator('#aacd-match-list').getAttribute('aria-busy'), 'true');
    assert.match(await page.locator('#aacd-connect-feedback').textContent(), /Enviando pedido ao parceiro/);
    // Disparo por script também deve respeitar a operação em andamento.
    await page.locator('[data-connect-order]').nth(1).dispatchEvent('click');
    state.sendGate.release();
    await page.locator('#aacd-pedidos').waitFor({ state: 'visible' });
    await until(async () => /Aguardando aceite/.test(await page.locator('#aacd-orders-feedback').textContent()), 'Confirmação ausente');
    assert.equal(state.posts, 1);
    assert.equal(state.details, 0, 'O envio não depende de um GET posterior');
    assert.equal(state.payload.request.code, 'UX-001');
    assert.equal(state.payload.selection.partnerId, '1');
    assert.match(await page.locator('#aacd-order-list').textContent(), /Aguardando aceite/);
    await snapshot(page, 'pedido-enviado-desktop');
    assert.deepEqual(state.errors, []);
  } finally { await context.close(); }
});

test('falha de envio mantém dados e permite tentar novamente', async () => {
  const { context, page, state } = await fixture();
  try {
    await draft(page); await matches(page);
    state.sendStatus = 503;
    await page.locator('[data-connect-order]').first().click();
    await until(async () => await page.locator('#aacd-connect-feedback').getAttribute('role') === 'alert', 'Erro ausente');
    assert.match(await page.locator('#aacd-connect-feedback').textContent(), /Não foi possível enviar o pedido/);
    assert.equal(await page.locator('[data-connect-order]:disabled').count(), 0);
    assert.equal(await page.locator('#aacd-order-code').inputValue(), 'UX-001');
    assert.equal(await page.locator('#aacd-order-url').inputValue(), order.link);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await snapshot(page, 'falha-envio-mobile');
    state.sendGate = gate(); state.sendStatus = 201;
    await page.locator('[data-connect-order]').first().click();
    assert.equal(await page.locator('#aacd-connect-feedback').getAttribute('role'), 'status');
    assert.match(await page.locator('#aacd-connect-feedback').textContent(), /^Enviando/);
    state.sendGate.release();
    await page.locator('#aacd-pedidos').waitFor({ state: 'visible' });
    assert.equal(state.posts, 2);
    assert.deepEqual(state.errors, []);
  } finally { await context.close(); }
});

test('falha de rede orienta a conferir Pedidos antes de reenviar', async () => {
  const { context, page, state } = await fixture();
  try {
    await draft(page); await matches(page);
    state.sendStatus = 'network';
    await page.locator('[data-connect-order]').first().click();
    await until(async () => await page.locator('#aacd-connect-feedback').getAttribute('role') === 'alert', 'Erro de rede ausente');
    assert.match(await page.locator('#aacd-connect-feedback').textContent(), /consulte Pedidos antes de tentar novamente/);
    assert.deepEqual(state.errors, []);
  } finally { await context.close(); }
});

test('falha ao atualizar a lista preserva a confirmação do envio', async () => {
  const { context, page, state } = await fixture();
  try {
    await draft(page); await matches(page);
    state.failListAfterSend = true;
    await page.locator('[data-connect-order]').first().click();
    await page.locator('#aacd-pedidos').waitFor({ state: 'visible' });
    await until(async () => /Recarregue a página/.test(await page.locator('#aacd-orders-feedback').textContent()), 'Orientação de atualização ausente');
    assert.match(await page.locator('#aacd-orders-feedback').textContent(), /enviado ao parceiro.*Aguardando aceite/);
    assert.equal(state.posts, 1);
    assert.deepEqual(state.errors, []);
  } finally { await context.close(); }
});

test('parceiro vê Aguardando aceite e ações com objeto explícito', async () => {
  const { context, page, state } = await fixture({ partner: true });
  try {
    await page.locator('#pending-orders .order-card').waitFor();
    assert.match(await page.locator('#pending-orders .order-status.waiting').textContent(), /Aguardando aceite/);
    assert.ok(await page.getByRole('button', { name: 'Aceitar pedido', exact: true }).isVisible());
    assert.ok(await page.getByRole('button', { name: 'Recusar pedido', exact: true }).isVisible());
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await snapshot(page, 'aceite-parceiro-mobile');
    assert.deepEqual(state.errors, []);
  } finally { await context.close(); }
});
