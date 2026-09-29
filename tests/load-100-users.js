// Execute SOMENTE em URL de homologação isolada. Não use produção.
// k6 run -e TARGET_URL=https://seu-ambiente-de-testes.example -e ALLOW_LOAD_TEST=SIM tests/load-100-users.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
const errors = new Rate('request_errors');
const target = (__ENV.TARGET_URL || '').replace(/\\/$/, '');
if (__ENV.ALLOW_LOAD_TEST !== 'SIM' || !target || /magiadosim\\.github\\.io|supabase\\.co|planner-casamento-two\\.vercel\\.app/.test(target)) {
  throw new Error('Defina TARGET_URL de homologação e ALLOW_LOAD_TEST=SIM. Produção bloqueada.');
}
export const options = {
  scenarios: { simultaneous_100: { executor: 'constant-vus', vus: 100, duration: '3m' } },
  thresholds: { http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<2000'], request_errors: ['rate<0.01'] }
};
export default function () {
  const res = http.get(target + '/planner-casamento/', { tags: { name: 'planner_home' } });
  const ok = check(res, { 'HTTP 200': r => r.status === 200, 'HTML entregue': r => r.body.includes('id="app"') });
  errors.add(!ok);
  sleep(Math.random() * 3 + 2);
}
// Testa a entrega pública do aplicativo. NÃO testa autenticação, salvamentos ou concorrência no Supabase.
