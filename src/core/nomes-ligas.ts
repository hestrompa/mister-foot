// Terras e clubes inventados dos campeonatos estrangeiros (Espanha e Inglaterra).
// Qualquer semelhança com um clube real é coincidência.

export interface NomesLiga {
  terras: readonly string[]
  padroes: readonly string[]
  estadios: readonly string[]
  /** Nomes e apelidos dos jogadores da casa. */
  nomes: readonly string[]
  apelidos: readonly string[]
  /** Regiões (para os dérbis), com "de". */
  regioes: { nome: string; de: string }[]
}

export const NOMES_LIGA: Record<string, NomesLiga> = {
  ES: {
    terras: [
      'Valdemora', 'Riosierra Alta', 'Castromayor', 'Puertollano del Mar', 'Villacerro', 'Montenegrillo', 'Alcarreña',
      'San Albar', 'Torrelobos', 'Navalmoral Nuevo', 'Peñaroja', 'Fuentesauco', 'Almendral', 'Robledal', 'Cabrales Bajo',
      'Santaclara del Río', 'Villaverde Alto', 'Olmedilla', 'Arenales', 'Campoalto', 'Ribadesella Vieja', 'Hontanar',
      'Villafranca del Cierzo', 'Portalegre de Castilla', 'Mirabel', 'Sotoreal', 'Calahonda', 'Torrevieja Alta',
      'Encinar', 'Valdepeña Nueva', 'Moraleda', 'Aguaviva', 'Barrancal', 'Cerromar', 'Lomas del Sur', 'Valderas',
    ],
    padroes: ['Real {T}', '{T} CF', 'Atlético {T}', 'CD {T}', 'UD {T}', 'SD {T}', 'Deportivo {T}', 'Racing {T}', 'Unión {T}', 'Sporting {T}'],
    estadios: ['Estadio Municipal de {T}', 'Campo de La Vega', 'Estadio El Pinar', 'Nuevo Estadio de {T}', 'Campo Los Olivos', 'Estadio La Ribera'],
    nomes: ['Javier', 'Sergio', 'Álvaro', 'Pablo', 'Iker', 'Marcos', 'Unai', 'Adrián', 'Raúl', 'Hugo', 'Dani', 'Óscar', 'Jorge', 'Rubén', 'Carlos', 'Mikel', 'Asier', 'Nacho', 'Borja', 'Íñigo'],
    apelidos: ['García', 'Martínez', 'López', 'Sánchez', 'Romero', 'Navarro', 'Torres', 'Iglesias', 'Garrido', 'Ocaña', 'Valverde', 'Rubio', 'Lozano', 'Arrieta', 'Cabello', 'Pacheco', 'Salinas', 'Urrutia', 'Vidal', 'Moreno', 'Herrera', 'Castillo', 'Ortega', 'Delgado'],
    regioes: [
      { nome: 'Andaluzia', de: 'da Andaluzia' }, { nome: 'Castela', de: 'de Castela' }, { nome: 'Catalunha', de: 'da Catalunha' },
      { nome: 'Galiza', de: 'da Galiza' }, { nome: 'País Basco', de: 'do País Basco' }, { nome: 'Levante', de: 'do Levante' },
    ],
  },
  EN: {
    terras: [
      'Ashbury', 'Thornwick', 'Kingsbridge', 'Marlow Heath', 'Hollinsworth', 'Bramcote', 'Fenmouth', 'Copperfield',
      'Eastleigh Vale', 'Harrowgate', 'Millbrook', 'Oakhampton', 'Redcliffe', 'Stonehaven', 'Wexley', 'Northam',
      'Ravensby', 'Ellesmoor', 'Blackwater', 'Saltby', 'Chalkford', 'Whitmore', 'Dunstable Cross', 'Ironbridge Moor',
      'Lindhurst', 'Pennington', 'Hawksworth', 'Greywell', 'Ambleside Port', 'Coldstream Lea', 'Fairhaven', 'Brookmere',
      'Highcliffe', 'Moorgate', 'Sandleigh', 'Westcombe',
    ],
    padroes: ['{T} United', '{T} Town', '{T} City', '{T} Rovers', '{T} Athletic', '{T} Wanderers', '{T} Albion', '{T} FC', '{T} County', '{T} Rangers'],
    estadios: ['{T} Park', 'The Meadow', 'Station Road', 'Riverside Ground', '{T} Lane', 'Victoria Ground', 'The Old Mill'],
    nomes: ['Jack', 'Harry', 'Oliver', 'George', 'Callum', 'Liam', 'Ryan', 'Connor', 'Jamie', 'Ben', 'Tom', 'Owen', 'Alfie', 'Charlie', 'Josh', 'Lewis', 'Danny', 'Kieran', 'Mason', 'Reece'],
    apelidos: ['Whitfield', 'Ashdown', 'Thornton', 'Pembrey', 'Hollis', 'Marsh', 'Copley', 'Radford', 'Kettle', 'Bramwell', 'Fenwick', 'Gale', 'Walker', 'Clarke', 'Hughes', 'Turner', 'Barker', 'Fletcher', 'Holt', 'Sutton', 'Price', 'Lambert', 'Moss', 'Shaw'],
    regioes: [
      { nome: 'Noroeste', de: 'do Noroeste' }, { nome: 'Midlands', de: 'das Midlands' }, { nome: 'Yorkshire', de: 'do Yorkshire' },
      { nome: 'Londres', de: 'de Londres' }, { nome: 'Nordeste', de: 'do Nordeste' }, { nome: 'Sudoeste', de: 'do Sudoeste' },
    ],
  },
}
