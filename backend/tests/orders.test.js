
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { loadConfig } from '../src/config.js';
import { createPool } from '../src/db.js';
import { createRepository } from '../src/repository.js';
import { createAuthService } from '../src/auth-service.js';
import { createGeoService } from '../src/geo.js';
import { createPrinterService } from '../src/printers.js';
import { createApp } from '../src/app.js';
import { haversine } from '../src/recommendations.js';
import { validateRequest } from '../src/request-validation.js';

const config = loadConfig();
assert.equal(process.env.NODE_ENV, 'test');
assert.ok(
  config.mysql.database.endsWith('_test') &&
    config.mongoDatabase.endsWith('_test')
);
config.bcryptCost = 4;
const pool = createPool(config.mysql),
  mongo = new MongoClient(config.mongoUri),
  tag = randomUUID();
let app,
  server,
  base,
  collection,
  printers,
  aacd,
  colleague,
  other,
  partner,
  stranger,
  printer,
  otherPrinter;
const password = 'Teste-1234!';

class Client {
  cookie = '';
  csrf = '';
  async send(method, path, body) {
    if (method !== 'GET' && !this.csrf)
      await this.send('GET', '/api/auth/csrf');
    const response = await fetch(base + path, {
      method,
      headers: {
        cookie: this.cookie,
        'content-type': 'application/json',
        'x-csrf-token': this.csrf
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    for (const cookie of response.headers.getSetCookie())
      if (cookie.startsWith('conexo.sid=')) this.cookie = cookie.split(';')[0];
    const value = await response.json();
    if (value.csrfToken) this.csrf = value.csrfToken;
    return { status: response.status, value };
  }
  async login(user) {
    assert.equal(
      (
        await this.send('POST', '/api/auth/login', {
          email: user.email,
          password
        })
      ).status,
      200
    );
    return this;
  }
}

const users = {};
const body = () => ({
  code: 'TEST-' + randomUUID(),
  priority: 'Padrão',
  volumes: { X: 100, Y: 120, Z: 50 },
  materials: ['PLA', 'PETG'],
  nozzles: [0.4],
  url: 'https://example.org/molde.stl',
  notes: 'Sem dados de paciente'
});
const printerBody = {
  modelo: 'FDM teste',
  capacidade: { x: 200, y: 200, z: 200 },
  bicos: [0.4],
  materiais_compativeis: ['PLA', 'PETG'],
  materiais_disponiveis: ['PLA']
};

async function create(draft = body()) {
  const r = await aacd.send('POST', '/api/solicitacoes', draft);
  assert.equal(r.status, 201, JSON.stringify(r.value));
  return r.value;
}
function selection(p = printer, u = users.partner) {
  return { partnerId: u.id, printerId: p._id, material: 'PLA', nozzle: 0.4 };
}
async function connect(s, choose = selection()) {
  const r = await aacd.send(
    'POST',
    `/api/solicitacoes/${s.id}/pedidos`,
    choose
  );
  assert.equal(r.status, 201, JSON.stringify(r.value));
  return r.value.id;
}

before(async () => {
  await mongo.connect();
  collection = mongo.db(config.mongoDatabase).collection('impressoras');
  printers = createPrinterService(collection);
  const auth = createAuthService(
    createRepository(pool),
    config,
    createGeoService()
  );
  for (const [name, unit] of [
    ['aacd', 'Mooca'],
    ['colleague', 'Mooca'],
    ['other', 'Ibirapuera']
  ])
    users[name] = await auth.register(
      'aacd',
      {
        email: `${name}-${tag}@example.org`,
        password,
        phone: '11988887777',
        unit,
        holder: 'Teste pedidos'
      },
      { seed: true }
    );
  for (const name of ['partner', 'stranger']) {
    users[name] = await auth.register('parceiro', {
      email: `${name}-${tag}@example.org`,
      password,
      phone: '11977776666',
      institution: 'Lab ' + name,
      responsible: 'Teste',
      street: 'Rua Teste',
      city: 'São Paulo',
      state: 'SP',
      latitude: -23.55,
      longitude: -46.63,
      locationConfirmed: true,
      termsAccepted: true
    });
    await pool.execute('UPDATE parceiro SET homologado=TRUE WHERE id=?', [
      users[name].id
    ]);
  }
  printer = await printers.save(users.partner, printerBody);
  otherPrinter = await printers.save(users.stranger, printerBody);
  app = createApp({ pool, config, geo: createGeoService(), printers });
  await app.locals.sessionStore.onReady();
  server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = 'http://127.0.0.1:' + server.address().port;
  aacd = await new Client().login(users.aacd);
  colleague = await new Client().login(users.colleague);
  other = await new Client().login(users.other);
  partner = await new Client().login(users.partner);
  stranger = await new Client().login(users.stranger);
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (app) await app.locals.sessionStore.close();
  await mongo.close();
  await pool.end();
});
