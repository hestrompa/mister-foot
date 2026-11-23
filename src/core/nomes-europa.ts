// Clubes estrangeiros das competições europeias: nomes e terras inventados.
// Qualquer semelhança com um clube real é coincidência.

export interface PaisEuropa {
  codigo: string
  nome: string
  /** Peso do campeonato: os grandes países têm clubes mais fortes. */
  peso: number
  nomes: readonly string[]
  apelidos: readonly string[]
}

const N_EN = ['Jack', 'Harry', 'Oliver', 'George', 'Callum', 'Liam', 'Ryan', 'Connor', 'Jamie', 'Ben', 'Tom', 'Owen']
const A_EN = ['Whitfield', 'Ashdown', 'Thornton', 'Pembrey', 'Hollis', 'Marsh', 'Copley', 'Radford', 'Kettle', 'Bramwell', 'Fenwick', 'Gale']
const N_ES = ['Javier', 'Sergio', 'Álvaro', 'Pablo', 'Iker', 'Marcos', 'Unai', 'Adrián', 'Raúl', 'Hugo', 'Dani', 'Óscar']
const A_ES = ['Garrido', 'Ocaña', 'Valverde', 'Rubio', 'Lozano', 'Arrieta', 'Cabello', 'Mendizábal', 'Pacheco', 'Salinas', 'Urrutia', 'Vidal']
const N_IT = ['Luca', 'Marco', 'Matteo', 'Davide', 'Simone', 'Andrea', 'Federico', 'Lorenzo', 'Riccardo', 'Paolo', 'Nicolò', 'Gianluca']
const A_IT = ['Bertolini', 'Castellani', 'Ferraro', 'Galbiati', 'Lombardo', 'Marchetti', 'Pellegrini', 'Rinaldi', 'Sartori', 'Vitale', 'Zanetti', 'Orsini']
const N_DE = ['Lukas', 'Jonas', 'Felix', 'Leon', 'Maximilian', 'Tim', 'Niklas', 'Jannik', 'Florian', 'Kai', 'Moritz', 'Tobias']
const A_DE = ['Brenner', 'Hofmann', 'Kessler', 'Lindner', 'Achterberg', 'Ritter', 'Seidel', 'Vogt', 'Wendt', 'Krämer', 'Ostermann', 'Falk']
const N_FR = ['Lucas', 'Hugo', 'Théo', 'Mathis', 'Enzo', 'Kylian', 'Antoine', 'Maxime', 'Bastien', 'Yanis', 'Rémi', 'Clément']
const A_FR = ['Lefèvre', 'Moreau', 'Garnier', 'Chevalier', 'Rousseau', 'Faure', 'Lemaire', 'Barbier', 'Delmas', 'Perrin', 'Marchand', 'Toussaint']
const N_NL = ['Daan', 'Sem', 'Bram', 'Jesse', 'Thijs', 'Ruben', 'Stijn', 'Joris', 'Milan', 'Lars']
const A_NL = ['de Vries', 'van Dam', 'Bakker', 'Visser', 'Smit', 'van Leeuwen', 'Mulder', 'de Groot', 'Kuipers', 'Verhoeven']
const N_LESTE = ['Luka', 'Marko', 'Ivan', 'Nikola', 'Petar', 'Tomasz', 'Jakub', 'Ondřej', 'Andrei', 'Bogdan', 'Oleksandr', 'Mateusz']
const A_LESTE = ['Kovač', 'Petrović', 'Horvat', 'Nowak', 'Wiśniewski', 'Dvořák', 'Popescu', 'Ionescu', 'Bondarenko', 'Jovanović', 'Marić', 'Kowalczyk']
const N_NORTE = ['Magnus', 'Emil', 'Oscar', 'William', 'Anton', 'Viktor', 'Elias', 'Mikkel', 'Rasmus', 'Henrik']
const A_NORTE = ['Lindqvist', 'Sørensen', 'Halvorsen', 'Nyberg', 'Dahl', 'Eklund', 'Bjerre', 'Holm', 'Andersen', 'Strand']
const N_TR = ['Emre', 'Burak', 'Mert', 'Arda', 'Kerem', 'Ozan', 'Yusuf', 'Kaan', 'Serkan', 'Volkan']
const A_TR = ['Yılmaz', 'Aydın', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Öztürk', 'Arslan', 'Doğan', 'Kurt']
const N_GR = ['Giorgos', 'Nikos', 'Dimitris', 'Kostas', 'Yannis', 'Christos', 'Panagiotis', 'Stelios', 'Vasilis', 'Thanos']
const A_GR = ['Papadakis', 'Nikolaou', 'Georgiou', 'Karras', 'Vlachos', 'Antoniou', 'Makris', 'Raptis', 'Samaras', 'Zervas']

export const PAISES_EUROPA: Record<string, PaisEuropa> = {
  EN: { codigo: 'EN', nome: 'Inglaterra', peso: 1, nomes: N_EN, apelidos: A_EN },
  ES: { codigo: 'ES', nome: 'Espanha', peso: 1, nomes: N_ES, apelidos: A_ES },
  IT: { codigo: 'IT', nome: 'Itália', peso: 0.95, nomes: N_IT, apelidos: A_IT },
  DE: { codigo: 'DE', nome: 'Alemanha', peso: 0.95, nomes: N_DE, apelidos: A_DE },
  FR: { codigo: 'FR', nome: 'França', peso: 0.8, nomes: N_FR, apelidos: A_FR },
  NL: { codigo: 'NL', nome: 'Países Baixos', peso: 0.65, nomes: N_NL, apelidos: A_NL },
  BE: { codigo: 'BE', nome: 'Bélgica', peso: 0.55, nomes: N_FR, apelidos: A_NL },
  SC: { codigo: 'SC', nome: 'Escócia', peso: 0.45, nomes: N_EN, apelidos: A_EN },
  TR: { codigo: 'TR', nome: 'Turquia', peso: 0.55, nomes: N_TR, apelidos: A_TR },
  GR: { codigo: 'GR', nome: 'Grécia', peso: 0.45, nomes: N_GR, apelidos: A_GR },
  AT: { codigo: 'AT', nome: 'Áustria', peso: 0.45, nomes: N_DE, apelidos: A_DE },
  CH: { codigo: 'CH', nome: 'Suíça', peso: 0.45, nomes: N_DE, apelidos: A_FR },
  HR: { codigo: 'HR', nome: 'Croácia', peso: 0.4, nomes: N_LESTE, apelidos: A_LESTE },
  RS: { codigo: 'RS', nome: 'Sérvia', peso: 0.4, nomes: N_LESTE, apelidos: A_LESTE },
  PL: { codigo: 'PL', nome: 'Polónia', peso: 0.35, nomes: N_LESTE, apelidos: A_LESTE },
  CZ: { codigo: 'CZ', nome: 'Chéquia', peso: 0.35, nomes: N_LESTE, apelidos: A_LESTE },
  UA: { codigo: 'UA', nome: 'Ucrânia', peso: 0.4, nomes: N_LESTE, apelidos: A_LESTE },
  RO: { codigo: 'RO', nome: 'Roménia', peso: 0.3, nomes: N_LESTE, apelidos: A_LESTE },
  DK: { codigo: 'DK', nome: 'Dinamarca', peso: 0.35, nomes: N_NORTE, apelidos: A_NORTE },
  SE: { codigo: 'SE', nome: 'Suécia', peso: 0.3, nomes: N_NORTE, apelidos: A_NORTE },
}

/** Clubes estrangeiros: [país, nome, terra, sigla, estádio]. */
export const CLUBES_EUROPA: [string, string, string, string, string][] = [
  ['EN', 'Kingsmere United', 'Kingsmere', 'KIN', 'Royal Meadow'],
  ['EN', 'Ashcombe Rovers', 'Ashcombe', 'ASH', 'Ashcombe Park'],
  ['EN', 'Thornfield City', 'Thornfield', 'THO', 'City Ground of Thornfield'],
  ['EN', 'Westharbour Athletic', 'Westharbour', 'WHA', 'Dockside Lane'],
  ['ES', 'Real Valmoral', 'Valmoral', 'VAL', 'Estadio del Moral'],
  ['ES', 'Atlético Riosierra', 'Riosierra', 'RIO', 'La Sierra'],
  ['ES', 'CD Castelvera', 'Castelvera', 'CSV', 'Campo de la Vera'],
  ['ES', 'Deportivo Puertolago', 'Puertolago', 'PLG', 'Estadio del Lago'],
  ['IT', 'AC Montecaldo', 'Montecaldo', 'MTC', 'Stadio del Colle'],
  ['IT', 'Sanlivio Calcio', 'Sanlivio', 'SNL', 'Stadio San Livio'],
  ['IT', 'Virtus Portoreale', 'Portoreale', 'POR', 'Arena del Porto'],
  ['IT', 'Valdorsa FC', 'Valdorsa', 'VDO', 'Stadio Valdorsa'],
  ['DE', 'FC Altenbruck', 'Altenbruck', 'ALT', 'Brückenstadion'],
  ['DE', 'SV Steinhafen', 'Steinhafen', 'STH', 'Hafenarena'],
  ['DE', 'Eintracht Hollerberg', 'Hollerberg', 'HOL', 'Bergstadion'],
  ['DE', 'TSV Lindenfeld', 'Lindenfeld', 'LIN', 'Lindenpark'],
  ['FR', 'Olympique Montreval', 'Montreval', 'OMV', 'Stade du Val'],
  ['FR', 'AS Belcourt', 'Belcourt', 'BEL', 'Parc de Belcourt'],
  ['FR', 'Stade Rochemont', 'Rochemont', 'ROC', 'Stade de la Roche'],
  ['FR', 'FC Lavigny', 'Lavigny', 'LAV', 'Stade des Vignes'],
  ['NL', 'Veldhaven SC', 'Veldhaven', 'VEL', 'Havenstadion'],
  ['NL', 'FC Lindewaard', 'Lindewaard', 'LDW', 'De Waard'],
  ['BE', 'Royal Ostervelde', 'Ostervelde', 'OST', 'Veldstadion'],
  ['BE', 'KV Brugmont', 'Brugmont', 'BRU', 'Montpark'],
  ['SC', 'Glenmuir Thistle', 'Glenmuir', 'GLE', 'Muirfield Road'],
  ['TR', 'Karadere Spor', 'Karadere', 'KAR', 'Dere Arena'],
  ['GR', 'Thalassa FC', 'Thalassa', 'THA', 'Gipedo Thalassas'],
  ['AT', 'SK Salzbrunn', 'Salzbrunn', 'SAL', 'Brunnenstadion'],
  ['CH', 'FC Bergtal', 'Bergtal', 'BGT', 'Stadion Bergtal'],
  ['HR', 'NK Zlatograd', 'Zlatograd', 'ZLA', 'Gradski stadion'],
  ['RS', 'FK Moravac', 'Moravac', 'MOR', 'Stadion Morava'],
  ['PL', 'KS Borowiec', 'Borowiec', 'BOR', 'Stadion Borowy'],
  ['CZ', 'SK Dubrava', 'Dubrava', 'DUB', 'Dubravský stadion'],
  ['UA', 'FK Dniprovets', 'Dniprovets', 'DNI', 'Rivne Arena'],
  ['RO', 'CS Carpatin', 'Carpatin', 'CAR', 'Stadionul Carpați'],
  ['DK', 'FC Nørrevik', 'Nørrevik', 'NOR', 'Vikparken'],
  ['SE', 'IF Sjöhamn', 'Sjöhamn', 'SJO', 'Hamnvallen'],
]

/** Cores dos clubes estrangeiros (principal, secundária). */
export const CORES_EUROPA: [string, string][] = [
  ['#b0102b', '#ffffff'], ['#1b3f8b', '#ffffff'], ['#ffffff', '#111111'], ['#0f5f3a', '#f2c94c'],
  ['#6a1b9a', '#ffffff'], ['#f2c94c', '#111111'], ['#111111', '#d32f2f'], ['#0277bd', '#ffeb3b'],
  ['#e65100', '#ffffff'], ['#4e342e', '#ffd54f'], ['#00897b', '#ffffff'], ['#c62828', '#1a237e'],
]
