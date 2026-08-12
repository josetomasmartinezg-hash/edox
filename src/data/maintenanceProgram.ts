export type MaintenanceIntervalId =
  | 'segun_requerido'
  | '10h_diario'
  | '50h'
  | '100h_inicial'
  | '250h'
  | '500h'
  | '1000h'
  | '2000h'
  | '4000h'
  | '5000h'
  | '6000h'
  | 'km_10000'
  | 'km_20000'

export type MaintenanceTask = {
  id: string
  label: string
}

export type MaintenanceInterval = {
  id: MaintenanceIntervalId
  label: string
  subtitle?: string
  tasks: MaintenanceTask[]
}

const LIGHT_TRUCK_TASKS_10000: MaintenanceTask[] = [
  { id: 'km10-aceite-motor', label: 'Cambio de aceite de motor' },
  { id: 'km10-filtro-aceite', label: 'Cambio de filtro de aceite' },
  { id: 'km10-filtro-aire', label: 'Revisión / limpieza de filtro de aire' },
  { id: 'km10-filtro-petroleo', label: 'Revisión de filtro de combustible y vaciado de agua' },
  { id: 'km10-refrigerante', label: 'Revisión de nivel de refrigerante' },
  { id: 'km10-frenos-liquido', label: 'Revisión de nivel de líquido de frenos' },
  { id: 'km10-direccion', label: 'Revisión de nivel de dirección hidráulica' },
  { id: 'km10-frenos', label: 'Inspección de frenos (pastillas, discos o tambores)' },
  { id: 'km10-neumaticos', label: 'Revisión de presión y estado de neumáticos (incluye repuesto)' },
  { id: 'km10-luces', label: 'Revisión de luces, señales y baliza' },
  { id: 'km10-correas', label: 'Inspección de correas' },
  { id: 'km10-bateria', label: 'Revisión de batería y apriete de bornes' },
  { id: 'km10-engrase', label: 'Engrase de puntos de lubricación / ballestas' },
  { id: 'km10-fugas', label: 'Revisión de fugas (motor, transmisión, diferencial)' },
  { id: 'km10-suspension', label: 'Revisión de suspensión, dirección y pernos de rueda' },
]

const LIGHT_TRUCK_TASKS_20000: MaintenanceTask[] = [
  ...LIGHT_TRUCK_TASKS_10000.map((t) => ({
    id: t.id.replace('km10-', 'km20-'),
    label: t.label,
  })),
  { id: 'km20-filtro-aire-cambio', label: 'Cambio de filtro de aire' },
  { id: 'km20-filtro-combustible', label: 'Cambio de filtro de combustible' },
  { id: 'km20-caja', label: 'Revisión / cambio de aceite de caja de cambios' },
  { id: 'km20-diferencial', label: 'Revisión / cambio de aceite de diferencial' },
  { id: 'km20-embrague', label: 'Revisión y regulación de embrague (si aplica)' },
  { id: 'km20-radiador', label: 'Limpieza de radiador y núcleos de enfriamiento' },
  { id: 'km20-diagnostico', label: 'Conexión de diagnóstico / revisión de códigos de falla' },
]

/** Pauta de mantenimiento de camiones livianos */
export const LIGHT_TRUCK_MAINTENANCE_PROGRAM: MaintenanceInterval[] = [
  {
    id: 'km_10000',
    label: '10.000 km',
    subtitle: 'Mantención periódica cada 10.000 kilómetros',
    tasks: LIGHT_TRUCK_TASKS_10000,
  },
  {
    id: 'km_20000',
    label: '20.000 km',
    subtitle: 'Mantención mayor cada 20.000 kilómetros',
    tasks: LIGHT_TRUCK_TASKS_20000,
  },
]

/** Programa de mantenimiento de tiempos operativos (manual John Deere 670D–872D) */
export const MAINTENANCE_PROGRAM: MaintenanceInterval[] = [
  {
    id: 'segun_requerido',
    label: 'Según se requiera',
    tasks: [
      { id: 'sr-eter', label: 'Revisión del cilindro del éter y sustitución de ser necesario (si existe)' },
      { id: 'sr-condensador', label: 'Limpieza del condensador del acondicionador de aire (si existe)' },
      {
        id: 'sr-filtros-cabina',
        label: 'Limpieza o sustitución de los filtros de aire fresco y de aire recirculado de la cabina',
      },
      { id: 'sr-pasador-caballete', label: 'Lubricación de agujeros del pasador de bloqueo del caballete' },
      { id: 'sr-pinon-circulo', label: 'Lubricación del piñón del círculo' },
      { id: 'sr-filtro-admision', label: 'Limpieza de filtro de admisión de aire del motor' },
      { id: 'sr-neumaticos', label: 'Inspección de los neumáticos y revisión de presión' },
      { id: 'sr-baterias', label: 'Limpieza de los bornes de la batería y apriete de los bornes' },
      {
        id: 'sr-insertos-circulo',
        label: 'Ajuste del espacio libre de los insertos de desgaste del círculo de hoja y bastidor de tiro',
      },
      {
        id: 'sr-tamiz-combustible',
        label: 'Sustitución del tamiz de combustible en línea (solo series 700 y 800)',
      },
      {
        id: 'sr-enchufes-cilindros',
        label: 'Ajuste o sustitución de los enchufes hembra de los cilindros de elevación de la cuchilla',
      },
      {
        id: 'sr-sumidero',
        label: 'Vaciado de agua y sedimentos del sumidero del depósito de combustible',
      },
      { id: 'sr-insertos-cuchilla', label: 'Cambio de los insertos de desgaste de la cuchilla' },
      { id: 'sr-correas', label: 'Inspección de correas' },
      { id: 'sr-refrigerante', label: 'Revisión del refrigerante' },
      { id: 'sr-nucleos', label: 'Limpieza de los núcleos de los enfriadores' },
    ],
  },
  {
    id: '10h_diario',
    label: 'Cada 10 horas o diariamente',
    tasks: [
      { id: '10-hidraulico', label: 'Revisión del nivel de aceite del sistema hidráulico' },
      { id: '10-motor', label: 'Revisión del nivel de aceite de motor' },
      { id: '10-transmision', label: 'Revisión del nivel de aceite de la transmisión' },
      { id: '10-refrigerante', label: 'Revisión del nivel de refrigerante' },
    ],
  },
  {
    id: '50h',
    label: 'Cada 50 horas de trabajo',
    tasks: [
      { id: '50-roturador', label: 'Lubricación de roturador/escarificador traseros (si existe)' },
      { id: '50-pivote-barra', label: 'Lubricación de pivote de barra de inclinación del eje delantero' },
      { id: '50-articulaciones', label: 'Lubricación de pivotes de las articulaciones de bastidor' },
      { id: '50-pasadores-dir', label: 'Lubricación de pasadores de dirección del eje delantero' },
      { id: '50-cil-dir-bastidor', label: 'Lubricación de pivotes de cilindro de dirección del bastidor' },
      { id: '50-barra-acoplamiento', label: 'Lubricación de extremos de barra de acoplamiento' },
      { id: '50-horquillas', label: 'Lubricación de pivotes de horquillas de cilindros de elevación' },
      {
        id: '50-embolo-dir',
        label: 'Lubricación de extremo del émbolo de pivotes de cilindro de dirección',
      },
      { id: '50-bola-tiro', label: 'Lubricación de bola de bastidor de tiro' },
      { id: '50-brazos-cuchilla', label: 'Lubricación de brazos y cilindros elevadores de cuchilla' },
      {
        id: '50-inclinacion-eje',
        label: 'Lubricación de pivotes de cilindro de inclinación de eje delantero',
      },
      { id: '50-bloqueo-caballete', label: 'Lubricación de pasador de bloqueo de caballete' },
      {
        id: '50-escarificador-del',
        label: 'Lubricación del escarificador/bulldozer sobre orugas delantero (si existe)',
      },
      { id: '50-paso-cuchilla', label: 'Lubricación de pivotes de cilindros de paso de cuchilla' },
      {
        id: '50-fundicion-eje',
        label: 'Lubricación de pasadores de pieza de fundición del pivote del eje delantero',
      },
      {
        id: '50-filtro-combustible',
        label: 'Revisión o vaciado de filtro de combustible primario y separador de agua',
      },
      { id: '50-oscilacion', label: 'Lubricación del pasador de oscilación del eje delantero' },
      {
        id: '50-escarificador-central',
        label: 'Lubricación de escarificador de montaje central (si existe)',
      },
    ],
  },
  {
    id: '100h_inicial',
    label: 'Mantenimiento inicial — 100 horas',
    subtitle: 'Realizar una vez cumplidas las primeras 100 horas de funcionamiento',
    tasks: [
      { id: '100-filtro-trans', label: 'Cambio del filtro de aceite de la transmisión' },
      { id: '100-filtro-dif', label: 'Cambio del filtro de aceite del diferencial' },
      { id: '100-aceite-motor', label: 'Cambio de aceite de rodaje del motor y el filtro' },
    ],
  },
  {
    id: '250h',
    label: 'Cada 250 horas de trabajo',
    tasks: [
      { id: '250-nivel-dif', label: 'Revisión de nivel de aceite del cárter del diferencial' },
      {
        id: '250-cubos',
        label: 'Revisión del nivel de aceite de los cubos de tracción en seis ruedas (si existe)',
      },
      {
        id: '250-secador',
        label: 'Revisión del indicador de humedad del secador del aire acondicionado (si existe)',
      },
      { id: '250-electrolito', label: 'Revisión de nivel de electrolito de batería' },
      {
        id: '250-ventilador',
        label: 'Lubricación del eje impulsor del ventilador (N.S. 610545— )',
      },
      { id: '250-muestreo-motor', label: 'Muestreo de aceite de motor' },
    ],
  },
  {
    id: '500h',
    label: 'Cada 500 horas de trabajo',
    tasks: [
      { id: '500-filtro-trans', label: 'Sustitución del filtro de aceite de la transmisión' },
      { id: '500-muestreo-eje', label: 'Muestreo de aceite para eje' },
      { id: '500-aceite-motor', label: 'Cambio del aceite del motor y el filtro' },
      { id: '500-muestreo-dif', label: 'Muestreo de aceite de diferencial' },
      { id: '500-nivel-circulo', label: 'Revisión de nivel de aceite de caja de engranajes de círculo' },
      { id: '500-muestreo-diesel', label: 'Muestreo de combustible diésel' },
      {
        id: '500-frenos',
        label: 'Revisión de acción de frenos y carga de acumulador (de ser necesario)',
      },
      { id: '500-muestreo-trans', label: 'Muestreo de aceite de la transmisión' },
      { id: '500-acond-refrig', label: 'Revisión del acondicionador de refrigerante en el radiador' },
      { id: '500-muestreo-tandem', label: 'Muestreo de aceite de tándem' },
      { id: '500-filtro-final', label: 'Sustitución del filtro de combustible final' },
      { id: '500-muestreo-refrig', label: 'Muestreo del refrigerante del motor' },
      { id: '500-nivel-tandem', label: 'Revisión de nivel de aceite de tándem' },
      { id: '500-muestreo-hid', label: 'Muestreo del aceite hidráulico' },
      { id: '500-filtro-primario', label: 'Sustitución del filtro de combustible primario' },
      {
        id: '500-muestreo-cubos',
        label: 'Muestreo de aceite de los cubos de tracción en seis ruedas (si existe)',
      },
    ],
  },
  {
    id: '1000h',
    label: 'Cada 1000 horas de trabajo',
    tasks: [
      { id: '1000-filtro-dif', label: 'Sustitución del filtro de aceite del cárter del diferencial' },
      { id: '1000-filtros-aire', label: 'Sustitución de filtros de admisión de aire de motor' },
      {
        id: '1000-traccion6',
        label: 'Cambio de aceite de la tracción en seis ruedas (si existe)',
      },
      { id: '1000-tazon', label: 'Sustitución de tazón de polvo (solo serie 600)' },
      {
        id: '1000-cojinetes',
        label: 'Limpieza, engrase y ajuste de cojinetes de ruedas delanteras',
      },
      {
        id: '1000-conductos',
        label: 'Revisión de conductos de admisión de aire en busca de grietas o conexiones flojas',
      },
    ],
  },
  {
    id: '2000h',
    label: 'Cada 2000 horas de trabajo',
    tasks: [
      {
        id: '2000-respiraderos',
        label: 'Sustitución de los respiraderos del eje trasero y del depósito hidráulico',
      },
      { id: '2000-pivotes-tandem', label: 'Engrase de pivotes del tándem' },
      { id: '2000-aceite-dif', label: 'Cambio de aceite del cárter del diferencial' },
      { id: '2000-tubo-vent', label: 'Limpieza del tubo de ventilación del cárter del motor' },
      { id: '2000-aceite-trans', label: 'Cambio de aceite de transmisión' },
      {
        id: '2000-malla',
        label: 'Limpieza de la malla filtrante de entrada de la bomba de la transmisión',
      },
      { id: '2000-aceite-circulo', label: 'Cambio de aceite de caja de engranajes de círculo' },
      { id: '2000-filtro-hid', label: 'Cambio de filtro de aceite hidráulico' },
      { id: '2000-valvulas', label: 'Ajuste del juego de válvulas del motor' },
    ],
  },
  {
    id: '4000h',
    label: 'Cada 4000 horas de trabajo',
    tasks: [
      { id: '4000-aceite-hid', label: 'Cambio del aceite del depósito hidráulico' },
      { id: '4000-aceite-tandem', label: 'Cambio de aceite del tándem' },
      { id: '4000-amortiguacion', label: 'Sustitución de la amortiguación de torsión' },
    ],
  },
  {
    id: '5000h',
    label: 'Cada 5000 horas de trabajo',
    tasks: [
      {
        id: '5000-amortiguador',
        label: 'Revisión del amortiguador del eje de transmisión en busca de fisuras',
      },
    ],
  },
  {
    id: '6000h',
    label: 'Cada 6000 horas de trabajo',
    tasks: [
      {
        id: '6000-refrigeracion',
        label: 'Vaciado, enjuague y llenado del sistema de refrigeración',
      },
    ],
  },
]

export function isLightTruckCategory(categoria?: string | null) {
  const value = String(categoria || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  return value.includes('camion') || value.includes('camioneta')
}

export function getProgramForCategory(categoria?: string | null) {
  if (isLightTruckCategory(categoria)) return LIGHT_TRUCK_MAINTENANCE_PROGRAM
  return MAINTENANCE_PROGRAM
}

export function defaultIntervalForCategory(categoria?: string | null): MaintenanceIntervalId {
  return isLightTruckCategory(categoria) ? 'km_10000' : '10h_diario'
}

export function getInterval(id: string) {
  return (
    LIGHT_TRUCK_MAINTENANCE_PROGRAM.find((item) => item.id === id) ||
    MAINTENANCE_PROGRAM.find((item) => item.id === id) ||
    null
  )
}

export function meterLabelForCategory(categoria?: string | null) {
  return isLightTruckCategory(categoria) ? 'Kilometraje' : 'Horómetro'
}
