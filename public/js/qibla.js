const kaaba = { lat: 21.4225, lng: 39.8262 };
const rad = (value) => value * Math.PI / 180;

export function qiblaBearing(lat, lng) {
  const longitude = rad(kaaba.lng - lng);
  const y = Math.sin(longitude) * Math.cos(rad(kaaba.lat));
  const x = Math.cos(rad(lat)) * Math.sin(rad(kaaba.lat)) - Math.sin(rad(lat)) * Math.cos(rad(kaaba.lat)) * Math.cos(longitude);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

export function directionName(degrees) {
  return ['Север', 'Северо-восток', 'Восток', 'Юго-восток', 'Юг', 'Юго-запад', 'Запад', 'Северо-запад'][Math.round(degrees / 45) % 8];
}
