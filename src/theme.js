export const COLORS = {
  navy: '#102A23',
  navyDeep: '#071F1B',
  blue: '#1A8068',
  blueBright: '#62D8AF',
  mint: '#62D8AF',
  bg: '#F8F7F1',
  card: '#FFFFFF',
  text: '#142720',
  muted: '#718078',
  border: '#E3E9E2',
  red: '#C94B4B',
  green: '#168568',
  amber: '#C58D36',
  paleBlue: '#E9F5EE',
  paleAmber: '#FFF4DF',
  gold: '#E2C37A',
  ink: '#080D0B',
};

export const SHADOW = {
  shadowColor: '#17382D',
  shadowOpacity: 0.07,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
};

export const RADIUS = { card: 22, control: 15, pill: 999 };

export const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
};

export const getRecordStatus = (record) => {
  const complete = Boolean(record?.location && record?.photo);
  return complete
    ? { label: 'Completo', color: COLORS.green, background: '#E8F6F0' }
    : { label: 'Pendente', color: COLORS.amber, background: COLORS.paleAmber };
};

export const getCompletionCount = (records) => records.filter((record) => record.location && record.photo).length;
export const getPendingCount = (records) => records.filter((record) => !(record.location && record.photo)).length;
export const getRecordStatusText = (record) => {
  if (record?.location && record?.photo) return 'Local e comprovante salvos';
  if (record?.location) return 'Falta apenas o comprovante';
  if (record?.photo) return 'Falta apenas a localização';
  return 'Adicione local e comprovante';
};

export default COLORS;
