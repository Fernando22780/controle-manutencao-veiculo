export const COLORS = {
  navy: '#102A43',
  navyDeep: '#071B2C',
  blue: '#137C8B',
  blueBright: '#2AA7A1',
  bg: '#F4F8F7',
  card: '#FFFFFF',
  text: '#173042',
  muted: '#6B7F8C',
  border: '#DCE8E7',
  red: '#C94B4B',
  green: '#2E9B75',
  amber: '#D58A28',
  paleBlue: '#E8F4F3',
  paleAmber: '#FFF4DF',
};

export const SHADOW = {
  shadowColor: '#102A43',
  shadowOpacity: 0.08,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 5 },
  elevation: 3,
};

export const RADIUS = { card: 20, control: 14, pill: 999 };

export const getGreeting = () => 'Olá';

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
