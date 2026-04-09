const STATE_TO_DDD: Record<string, string> = {
  'AC': '68', 'AL': '82', 'AP': '96', 'AM': '92', 'BA': '71', 'CE': '85', 'DF': '61',
  'ES': '27', 'GO': '62', 'MA': '98', 'MT': '65', 'MS': '67', 'MG': '31', 'PA': '91',
  'PB': '83', 'PR': '41', 'PE': '81', 'PI': '86', 'RJ': '21', 'RN': '84', 'RS': '51',
  'RO': '69', 'RR': '95', 'SC': '48', 'SP': '11', 'SE': '79', 'TO': '63',
  'ACRE': '68', 'ALAGOAS': '82', 'AMAPA': '96', 'AMAPÁ': '96', 'AMAZONAS': '92',
  'BAHIA': '71', 'CEARA': '85', 'CEARÁ': '85', 'DISTRITO FEDERAL': '61',
  'ESPIRITO SANTO': '27', 'ESPÍRITO SANTO': '27', 'GOIAS': '62', 'GOIÁS': '62',
  'MARANHAO': '98', 'MARANHÃO': '98', 'MATO GROSSO': '65', 'MATO GROSSO DO SUL': '67',
  'MINAS GERAIS': '31', 'PARA': '91', 'PARÁ': '91', 'PARAIBA': '83', 'PARAÍBA': '83',
  'PARANA': '41', 'PARANÁ': '41', 'PERNAMBUCO': '81', 'PIAUI': '86', 'PIAUÍ': '86',
  'RIO DE JANEIRO': '21', 'RIO GRANDE DO NORTE': '84', 'RIO GRANDE DO SUL': '51',
  'RONDONIA': '69', 'RONDÔNIA': '69', 'RORAIMA': '95', 'SANTA CATARINA': '48',
  'SAO PAULO': '11', 'SÃO PAULO': '11', 'SERGIPE': '79', 'TOCANTINS': '63'
};

export interface UserLocation {
  city: string;
  ddd: string;
}

const findDDD = (region: string): string => {
  if (!region) return '11';
  const normalized = region.toUpperCase().trim();
  return STATE_TO_DDD[normalized] || '11';
};

export const getUserLocation = async (): Promise<UserLocation> => {
  try {
    const response = await fetch('https://get.geojs.io/v1/ip/geo.json');
    const data = await response.json();
    if (data.city) {
      const city = data.city;
      const ddd = findDDD(data.region || 'SP');
      console.log('📍 Localização (GeoJS):', city, ddd);
      return { city, ddd };
    }
  } catch (error) {
    console.warn("GeoJS falhou, tentando backup...", error);
  }

  try {
    const response = await fetch('https://ipapi.co/json/');
    if (response.ok) {
      const data = await response.json();
      const city = data.city || 'São Paulo';
      const ddd = findDDD(data.region_code || data.region || 'SP');
      console.log('📍 Localização (IPAPI):', city, ddd);
      return { city, ddd };
    }
  } catch (error) {
    console.warn("IPAPI falhou, tentando última opção...", error);
  }

  try {
    const response = await fetch('https://ipwho.is/');
    const data = await response.json();
    if (data.success) {
      const city = data.city;
      const ddd = findDDD(data.region_code || 'SP');
      console.log('📍 Localização (IPWHO):', city, ddd);
      return { city, ddd };
    }
  } catch (error) {
    console.error("Todas as APIs falharam.");
  }

  return { city: 'São Paulo', ddd: '11' };
};

export const getCurrentTime = (): string => {
  const date = new Date();
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};
