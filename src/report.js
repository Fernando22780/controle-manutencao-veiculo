import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { describeNext, formatDateBR, formatKm, formatMoney, parseDateBR, sumCost } from './maintenanceUtils';

const MAX_PHOTOS = 24;
const esc = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Reduz a foto e converte para base64, assim o PDF abre igual no Android e no iPhone
// e não fica gigante.
async function photoToDataUri(uri) {
  try {
    const context = ImageManipulator.manipulate(uri);
    context.resize({ width: 520 });
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ base64: true, compress: 0.6, format: SaveFormat.JPEG });
    return saved.base64 ? `data:image/jpeg;base64,${saved.base64}` : null;
  } catch (error) {
    console.warn('Não foi possível incluir um comprovante no PDF:', error);
    return null;
  }
}

function buildHtml({ vehicle, records, currentKm, photos }) {
  const total = sumCost(records);
  const hasCost = records.some((r) => r.cost !== null && r.cost !== undefined);
  const rows = records.map((r) => `<tr>
    <td>${esc(r.date)}</td>
    <td>${esc(r.description)}${r.reminder ? `<div class="sub">Próxima: ${esc(describeNext(r.reminder))}</div>` : ''}</td>
    <td class="num">${r.km !== null && r.km !== undefined ? `${formatKm(r.km)} km` : '—'}</td>
    <td class="num">${r.cost !== null && r.cost !== undefined ? formatMoney(r.cost) : '—'}</td>
  </tr>`).join('');
  const gallery = photos.length ? `<h2>Comprovantes</h2><div class="grid">${photos.map(({ record, uri }) => `<div class="photo"><img src="${uri}" /><div class="cap">${esc(record.date)} · ${esc(record.description)}</div></div>`).join('')}</div>${records.filter((r) => r.photo).length > photos.length ? `<p class="note">Mostrando ${photos.length} comprovantes mais recentes.</p>` : ''}` : '';
  return `<!doctype html><html><head><meta charset="utf-8" /><style>
    @page { margin: 28px; }
    body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #142720; font-size: 12px; }
    .head { background: #071F1B; color: #fff; padding: 18px 20px; border-radius: 12px; }
    .head small { color: #62D8AF; letter-spacing: 1.5px; font-size: 9px; font-weight: 700; }
    .head h1 { margin: 6px 0 2px; font-size: 22px; }
    .head p { margin: 0; color: #C4D1CB; }
    .stats { display: flex; gap: 10px; margin: 14px 0 6px; }
    .stat { flex: 1; border: 1px solid #E3E9E2; border-radius: 10px; padding: 10px; }
    .stat b { display: block; font-size: 16px; margin-top: 3px; }
    .stat span { color: #718078; font-size: 10px; }
    h2 { font-size: 14px; margin: 20px 0 8px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; color: #718078; font-size: 10px; border-bottom: 1.5px solid #142720; padding: 6px 4px; }
    td { padding: 8px 4px; border-bottom: 1px solid #E3E9E2; vertical-align: top; }
    .num { text-align: right; white-space: nowrap; }
    th.num { text-align: right; }
    .sub { color: #168568; font-size: 10px; margin-top: 2px; }
    .total td { border-bottom: none; border-top: 1.5px solid #142720; font-weight: 700; }
    .grid { display: flex; flex-wrap: wrap; gap: 10px; }
    .photo { width: 31%; page-break-inside: avoid; }
    .photo img { width: 100%; height: 130px; object-fit: cover; border-radius: 8px; border: 1px solid #E3E9E2; }
    .cap { font-size: 9px; color: #718078; margin-top: 3px; }
    .note { color: #718078; font-size: 10px; }
    .foot { margin-top: 24px; color: #718078; font-size: 10px; text-align: center; }
  </style></head><body>
    <div class="head"><small>CONTROLE DE MANUTENÇÃO</small><h1>${esc(vehicle.name)}</h1><p>${esc(vehicle.plate || 'Placa não cadastrada')}${vehicle.year ? ` · Ano ${esc(vehicle.year)}` : ''}</p></div>
    <div class="stats">
      <div class="stat"><span>Serviços registrados</span><b>${records.length}</b></div>
      <div class="stat"><span>Km atual</span><b>${currentKm !== null && currentKm !== undefined ? `${formatKm(currentKm)} km` : '—'}</b></div>
      <div class="stat"><span>Total gasto</span><b>${hasCost ? formatMoney(total) : '—'}</b></div>
    </div>
    <h2>Histórico de manutenção</h2>
    <table><thead><tr><th>Data</th><th>Serviço</th><th class="num">Km</th><th class="num">Valor</th></tr></thead><tbody>${rows}${hasCost ? `<tr class="total"><td colspan="3">Total</td><td class="num">${formatMoney(total)}</td></tr>` : ''}</tbody></table>
    ${gallery}
    <div class="foot">Relatório gerado em ${formatDateBR(new Date())}</div>
  </body></html>`;
}

export async function shareVehicleReport({ vehicle, records, currentKm }) {
  const sorted = [...records].sort((a, b) => (parseDateBR(b.date)?.getTime() || 0) - (parseDateBR(a.date)?.getTime() || 0));
  const photos = [];
  for (const record of sorted) {
    if (photos.length >= MAX_PHOTOS) break;
    if (!record.photo) continue;
    const uri = await photoToDataUri(record.photo);
    if (uri) photos.push({ record, uri });
  }
  const { uri } = await Print.printToFileAsync({ html: buildHtml({ vehicle, records: sorted, currentKm, photos }) });
  if (!(await Sharing.isAvailableAsync())) throw new Error('sharing-unavailable');
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: `Relatório – ${vehicle.name}` });
  return uri;
}
