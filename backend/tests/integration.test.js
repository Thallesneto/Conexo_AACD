
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { MongoClient } from 'mongodb';
import { loadConfig } from '../src/config.js';
import { createPool } from '../src/db.js';
import { createRepository } from '../src/repository.js';
import { createAuthService } from '../src/auth-service.js';
import { createGeoService, insideBrazil } from '../src/geo.js';
import { createPrinterService } from '../src/printers.js';
import { createApp } from '../src/app.js';

const config = loadConfig();
assert.equal(
  process.env.NODE_ENV,
  'test',
  'Use NODE_ENV=test para a suíte com bancos descartáveis.'
);
assert.ok(
  config.mysql.database.endsWith('_test') &&
    config.mongoDatabase.endsWith('_test'),
  'A suíte só aceita bancos terminados em _test.'
);
config.bcryptCost = 4; // Somente fixture de teste; a configuração de execução permanece custo 12.
const pool = createPool(config.mysql),
  mongo = new MongoClient(config.mongoUri),
  suffix = randomUUID().slice(0, 8);
let app, server, base, collection, root, pending, partner;
const credentials = { password: 'Teste-1234!' };

class Client {
  cookie = '';
  csrf = '';

  async request(method, path, body, { csrf = true, header } = {}) {
    if (csrf && !['GET', 'HEAD'].includes(method) && !this.csrf)
      await this.request('GET', '/api/auth/csrf');
    const headers = { cookie: this.cookie };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (csrf && this.csrf) headers['x-csrf-token'] = this.csrf;
    if (header) headers['x-csrf-token'] = header;
    const response = await fetch(base + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    for (const cookie of response.headers.getSetCookie())
      if (cookie.startsWith('conexo.sid=')) this.cookie = cookie.split(';')[0];
    const contentType = response.headers.get('content-type') || '';
    const value =
      response.status === 204
        ? null
        : contentType.includes('application/json')
          ? await response.json()
          : await response.text();
    if (value?.csrfToken) this.csrf = value.csrfToken;
    return { status: response.status, value, headers: response.headers };
  }

  async login(email) {
    const r = await this.request('POST', '/api/auth/login', {
      email,
      ...credentials,
      perfil: 'parceiro'
    });
    assert.equal(r.status, 200);
    return r.value.user;
  }
}

const aacdBody = (email) => ({
  email,
  ...credentials,
  phone: '11988887777',
  unit: 'Mooca',
  holder: 'Conta teste'
});
const partnerBody = (email) => ({
  email,
  ...credentials,
  phone: '11977776666',
  institution: 'Lab de teste',
  responsible: 'Responsável teste',
  street: 'Avenida Paulista',
  number: '',
  city: 'São Paulo',
  state: 'SP',
  latitude: -23.55,
  longitude: -46.63,
  locationConfirmed: true,
  termsAccepted: true
});
const printerBody = {
  modelo: 'FDM de teste',
  capacidade: { x: 200, y: 200, z: 200 },
  bicos: [0.4],
  materiais_compativeis: ['PLA', 'PETG'],
  materiais_disponiveis: ['PLA']
};
before(async () => {
  await mongo.connect();
  collection = mongo.db(config.mongoDatabase).collection('impressoras');
  const auth = createAuthService(
    createRepository(pool),
    config,
    createGeoService()
  );
  root = await auth.register(
    'aacd',
    aacdBody('root-' + suffix + '@example.org'),
    { seed: true }
  );
  app = createApp({
    pool,
    config,
    geo: createGeoService(),
    printers: createPrinterService(collection)
  });
  await app.locals.sessionStore.onReady();
  server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = 'http://127.0.0.1:' + server.address().port;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (app) await app.locals.sessionStore.close();
  await mongo.close();
  await pool.end();
});
