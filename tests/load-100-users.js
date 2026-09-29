// Execute somente em ambiente isolado de homologação, nunca na produção.
// k6 run -e TARGET_URL=https://staging.example.test/planner-casamento/ -e ALLOW_LOAD_TEST=SIM tests/load-100-users.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
const errors = new Rate('request_errors');
const target = (__ENV.TARGET_URL || '').trim();
let parsed;
try { parsed = new URL(target); } catch (_) { throw new Error('TARGET_URL deve ser uma URL completa de homologação.'); }
const hostname = parsed.hostname.toLowerCase();
const blocked = ['magiadosim.github.io', 'supabase.co', 'planner-casamento-two.vercel.app'];
if (__ENV.ALLOW_LOAD_TEST !== 'SIM' || parsed.protocol !== 'https:' || blocked.some(h => hostname === h || hostname.endsWith('.' + h))) {
  throw new Error('Somente homologação HTTPS autorizada. Produção bloqueada.');
}
export const options = {
  scenarios: { simultaneous_100: { executor: 'constant-vus', vus: 100, duration: '3m' } },
  thresholds: { http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<2000'], request_errors: ['rate<0.01'] }
};
export default function () {
  const res = http.get(target, { tags: { name: 'planner_home' } });
  const ok = check(res, { 'HTTP 200': r => r.status === 200, 'HTML entregue': r => r.body.includes('id="app"') });
  errors.add(!ok);
  sleep(Math.random() * 3 + 2);
}
// Testa a entrega pública do HTML; não prova capacidade de autenticação ou escrita concorrente no banco.
