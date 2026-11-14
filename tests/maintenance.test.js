const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let utils;
let biometric;
test('carrega os utilitários reais do aplicativo', async () => {
  utils = await import('../src/maintenanceUtils.js');
  biometric = await import('../src/biometricUtils.js');
  assert.equal(typeof utils.parseDateBR, 'function');
  assert.equal(typeof biometric.shouldDismissBiometricLock, 'function');
});

test('valida datas existentes e rejeita datas impossíveis', () => {
  assert.equal(utils.formatDateBR(utils.parseDateBR('29/02/2024')), '29/02/2024');
  assert.equal(utils.parseDateBR('29/02/2023'), null);
  assert.equal(utils.parseDateBR('31/04/2025'), null);
  assert.equal(utils.parseDateBR('2025-04-30'), null);
});

test('normaliza horários e rejeita valores fora do relógio', () => {
  assert.equal(utils.normalizeReminderTime('9:05'), '09:05');
  assert.equal(utils.normalizeReminderTime('23:59'), '23:59');
  assert.equal(utils.normalizeReminderTime('24:00'), null);
  assert.equal(utils.normalizeReminderTime('10:60'), null);
  assert.equal(utils.normalizeReminderTime('abc'), null);
});

test('interpreta e formata quilometragem brasileira', () => {
  assert.equal(utils.parseKm('45.200 km'), 45200);
  assert.equal(utils.parseKm(''), null);
  assert.equal(utils.formatKm(45200), '45.200');
  assert.equal(utils.formatKmInput('12a345678'), '1.234.567');
});

test('interpreta valores monetários em formato brasileiro', () => {
  assert.equal(utils.parseMoney('R$ 1.234,56'), 1234.56);
  assert.equal(utils.parseMoney('12.50'), 12.5);
  assert.equal(utils.parseMoney(''), null);
  assert.equal(utils.parseMoney('-10,00'), null);
  assert.equal(utils.formatMoney(1234.5), 'R$ 1.234,50');
});

test('monta lembrete por data e quilometragem', () => {
  const reminder = utils.buildReminder({ dateStr: '31/01/2025', km: 10000, kmInterval: 5000, monthsInterval: 1, time: '8:30' });
  assert.equal(reminder.nextKm, 15000);
  assert.equal(reminder.nextDate, '28/02/2025');
  assert.equal(reminder.time, '08:30');
  assert.equal(utils.buildReminder({ dateStr: '01/01/2025' }), null);
});

test('usa a maior quilometragem entre veículo e histórico', () => {
  assert.equal(utils.getCurrentKm({ currentKm: 30000 }, [{ km: 32000 }, { km: 25000 }]), 32000);
  assert.equal(utils.getCurrentKm({}, [{ km: null }]), null);
});

test('filtra registros sem diferenciar acentos e respeita o veículo', () => {
  const vehicles = [{ id: 'v1', name: 'Carro Azul' }, { id: 'v2', name: 'Carro Verde' }];
  const records = [
    { id: '1', vehicleId: 'v1', description: 'Troca de óleo', date: '10/04/2025' },
    { id: '2', vehicleId: 'v2', description: 'Troca de óleo', date: '11/04/2025' },
  ];
  assert.deepEqual(utils.filterRecords(records, vehicles, { vehicleId: 'v1', query: 'oleo' }).map((r) => r.id), ['1']);
  assert.deepEqual(utils.filterRecords(records, vehicles, { vehicleId: 'all', query: 'troca oleo' }).map((r) => r.id), ['1', '2']);
});

test('associa registros antigos ao veículo pelo nome', () => {
  const vehicle = { id: 'v1', name: 'Civic' };
  assert.equal(utils.belongsToVehicle({ vehicle: 'Civic' }, vehicle), true);
  assert.equal(utils.belongsToVehicle({ vehicleId: 'v2', vehicle: 'Civic' }, vehicle), false);
});

test('calcula despesas e agrupa serviços', () => {
  const records = [
    { description: 'Troca de óleo', cost: 100, date: '10/05/2025' },
    { description: 'Troca de óleo', cost: 50, date: '20/05/2025' },
    { description: 'Pneu', cost: 300, date: '01/04/2025' },
  ];
  assert.equal(utils.sumCost(records), 450);
  assert.equal(utils.sumCostMonth(records, new Date(2025, 4, 15)), 150);
  assert.deepEqual(utils.costByService(records).map((item) => [item.label, item.total, item.count]), [
    ['Pneu', 300, 1],
    ['Troca de óleo', 150, 2],
  ]);
});

test('cancelar biometria fecha o bloqueio, mas falhas não', () => {
  assert.equal(biometric.shouldDismissBiometricLock({ success: true }), true);
  for (const error of ['user_cancel', 'app_cancel', 'system_cancel']) {
    assert.equal(biometric.shouldDismissBiometricLock({ success: false, error }), true);
  }
  for (const error of ['authentication_failed', 'not_available', 'lockout']) {
    assert.equal(biometric.shouldDismissBiometricLock({ success: false, error }), false);
  }
  assert.equal(biometric.shouldDismissBiometricLock(null), false);
});

test('a tela principal não oferece mais geração de relatório PDF', () => {
  const home = fs.readFileSync(path.join(__dirname, '../src/screens/HomeScreen.js'), 'utf8');
  assert.doesNotMatch(home, /shareVehicleReport|Gerar relatório|gerar.*PDF/i);
  assert.equal(fs.existsSync(path.join(__dirname, '../src/report.js')), false);
});

test('o comprovante capturado precisa ser confirmado antes de ser salvo', () => {
  const maintenance = fs.readFileSync(path.join(__dirname, '../src/screens/MaintenanceScreen.js'), 'utf8');
  const detail = fs.readFileSync(path.join(__dirname, '../src/screens/RecordDetailScreen.js'), 'utf8');
  for (const source of [maintenance, detail]) {
    assert.match(source, /capturedPhoto/);
    assert.match(source, /Usar comprov(?:ante|ativo)/);
    assert.match(source, /Tirar novamente/);
  }
});
