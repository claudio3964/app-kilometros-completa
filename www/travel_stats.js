// =====================================================
// TRAVEL STATS ENGINE
// Motor de estadísticas reales de viajes
// =====================================================

const TRAVEL_STATS_KEY = "travel_stats_v1";


// obtener todas las estadísticas
function getTravelStats(){

  const raw = localStorage.getItem(TRAVEL_STATS_KEY);

  if(!raw) return {};

  try{
    return JSON.parse(raw);
  }catch{
    return {};
  }

}


// guardar estadísticas completas
function saveTravelStats(stats){

  localStorage.setItem(
    TRAVEL_STATS_KEY,
    JSON.stringify(stats)
  );

}


// registrar viaje finalizado
function registrarEstadisticaViaje(travel){

  if(!travel) return;

  if(!travel.origen || !travel.destino) return;
  if(!travel.departureTime || !travel.arrivalTime) return;

  const key = travel.origen + "→" + travel.destino;

  const salida = convertirHoraAMin(travel.departureTime);
  const llegada = convertirHoraAMin(travel.arrivalTime);

  let duracion = llegada - salida;

  if(duracion <= 0) return;

  const velocidad =
    travel.kmEmpresa
      ? (travel.kmEmpresa / (duracion / 60))
      : 0;

  const stats = getTravelStats();

  if(!stats[key]){

    stats[key] = {

      origen: travel.origen,
      destino: travel.destino,

      totalViajes: 0,

      totalMinutos: 0,

      velocidadPromedio: 0

    };

  }

  const s = stats[key];

  s.totalViajes += 1;

  s.totalMinutos += duracion;

  s.velocidadPromedio =
    (
      (s.velocidadPromedio * (s.totalViajes - 1))
      + velocidad
    )
    / s.totalViajes;

  saveTravelStats(stats);

  console.log("📊 Estadística guardada:", stats[key]);

}


// obtener duración promedio estimada
function obtenerDuracionPromedio(origen, destino){

  const stats = getTravelStats();

  const key = origen + "→" + destino;

  const stat = stats[key];

if(!stat || stat.totalViajes < 3){
  return null;
}

return Math.floor(
  stat.totalMinutos / stat.totalViajes
);

}


// util convertir HH:mm a minutos
function convertirHoraAMin(hhmm){

  const [h,m] = hhmm.split(":");

  return parseInt(h)*60 + parseInt(m);

}


// debug
window.getTravelStats = getTravelStats;
window.obtenerDuracionPromedio = obtenerDuracionPromedio;