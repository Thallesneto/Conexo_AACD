
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
