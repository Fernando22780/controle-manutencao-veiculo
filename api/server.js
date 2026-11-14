const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const PORT = Number(process.env.PORT || 3000);
const DATA_FILE = path.join(__dirname, 'data.json');

async function readData() {
  try { return JSON.parse(await fs.readFile(DATA_FILE, 'utf8')); } catch { return { records: {}, vehicles: {} }; }
}
async function writeData(data) { await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2)); }
function send(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify(body)); }
async function body(req) { let raw = ''; for await (const chunk of req) raw += chunk; return raw ? JSON.parse(raw) : {}; }

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' }); return res.end(); }
  if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true, service: 'controle-manutencao-api', time: new Date().toISOString() });
  if (req.method === 'POST' && req.url === '/travel-cost') {
    const input = await body(req);
    const distanceKm = Number(input.distanceKm);
    const consumptionKmPerLiter = Number(input.consumptionKmPerLiter);
    const fuelPrice = Number(input.fuelPrice);
    const multiplier = input.roundTrip ? 2 : 1;
    if (!(distanceKm > 0) || !(consumptionKmPerLiter > 0) || !(fuelPrice > 0)) return send(res, 400, { ok: false, message: 'Informe distância, consumo e preço válidos.' });
    const totalDistanceKm = distanceKm * multiplier;
    const fuelLiters = totalDistanceKm / consumptionKmPerLiter;
    return send(res, 200, { ok: true, totalDistanceKm, fuelLiters, fuelCost: fuelLiters * fuelPrice, roundTrip: Boolean(input.roundTrip) });
  }
  const match = req.url?.match(/^\/sync\/(records|vehicles)\/([^/]+)$/);
  if (match && ['PUT', 'DELETE'].includes(req.method)) {
    const [, entity, id] = match; const data = await readData();
    if (req.method === 'DELETE') delete data[entity][id]; else data[entity][id] = await body(req);
    await writeData(data); return send(res, 200, { ok: true, entity, id });
  }
  send(res, 404, { ok: false, message: 'Rota não encontrada.' });
});
server.listen(PORT, '0.0.0.0', () => console.log(`API listening on http://0.0.0.0:${PORT}`));
