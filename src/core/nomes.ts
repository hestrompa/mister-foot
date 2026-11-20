// Nomes inventados. Terras e clubes são fictícios, com sabor português;
// qualquer semelhança com um clube real é coincidência.

export const TERRAS = [
  'Vila Serrana', 'Porto Alvar', 'Alcamar', 'Montalvo', 'Ribamar do Sul', 'Castelo Branco do Mar',
  'Vale Fundo', 'Santa Luzia da Serra', 'Ponte Velha', 'Sobral Novo', 'Alverca da Ribeira', 'Monte Real do Norte',
  'Lagoa Seca', 'Torre de Alvim', 'Fontelas', 'Arrifes Altos', 'Cabeço Verde', 'Penaguda',
  'Vilarinho das Pedras', 'Souto Maior', 'Almofala', 'Carvalhal Grande', 'Belmonte do Vale', 'Ervedosa',
  'São Brás da Ponte', 'Quinta Nova', 'Milreu', 'Azinhaga do Sul', 'Malhadas', 'Ourique Velho',
  'Cova da Moura Alta', 'Pedrógão do Mar', 'Rio Frio do Norte', 'Valverde', 'Atalaia Nova', 'Bouça',
  'Castanheira', 'Figueiral', 'Lameiras', 'Mosteirô', 'Pinhal Novo do Norte', 'Ribeira Grande do Sul',
  'Seixal de Cima', 'Tojal', 'Urgeiriça', 'Vale de Cambra Nova', 'Zambujal', 'Aldeia Galega',
  'Barrocal', 'Corgas', 'Espinhal', 'Fontainhas', 'Gândara', 'Juncal',
  'Lourinhã Velha', 'Mourão do Rio', 'Nogueira', 'Oleiros do Sul', 'Paços Novos', 'Queluz de Baixo',
  'Rebordelo', 'Sabugal Novo', 'Tavarede', 'Ucanha', 'Vermoil', 'Xarrama',
  'Alpedrinha', 'Benavila', 'Carrapateira', 'Dornelas', 'Escalhão', 'Freixial',
  'Gouveia Nova', 'Hortinhas', 'Idanha do Mar', 'Lavradio Alto', 'Mafra Velha', 'Nisa Nova',
] as const

export const PADROES_CLUBE = [
  'Sporting Clube de {T}', '{T} Futebol Clube', 'Atlético de {T}', 'União de {T}', 'Desportivo de {T}',
  'Académico de {T}', 'Grupo Desportivo de {T}', 'Clube Oriental de {T}', 'Lusitano de {T}', 'Recreativo de {T}',
  'Clube Desportivo de {T}', 'Associação Desportiva de {T}', 'Juventude de {T}', 'Operário de {T}',
] as const

export const NOMES_PT = [
  'João', 'Rui', 'Tiago', 'Pedro', 'Miguel', 'André', 'Bruno', 'Ricardo', 'Diogo', 'Nuno', 'Luís', 'Hugo',
  'Gonçalo', 'Rafael', 'Francisco', 'Duarte', 'Martim', 'Tomás', 'Afonso', 'Vasco', 'Filipe', 'Sérgio', 'Paulo',
  'Fábio', 'Hélder', 'Daniel', 'David', 'Rodrigo', 'Simão', 'Jorge', 'Carlos', 'Manuel', 'Gil', 'Rúben',
]

export const APELIDOS_PT = [
  'Silva', 'Santos', 'Ferreira', 'Pereira', 'Oliveira', 'Costa', 'Rodrigues', 'Martins', 'Jesus', 'Sousa',
  'Fernandes', 'Gonçalves', 'Gomes', 'Lopes', 'Marques', 'Alves', 'Almeida', 'Ribeiro', 'Pinto', 'Carvalho',
  'Teixeira', 'Moreira', 'Correia', 'Mendes', 'Nunes', 'Soares', 'Vieira', 'Monteiro', 'Cardoso', 'Rocha',
  'Neves', 'Coelho', 'Cruz', 'Cunha', 'Pires', 'Ramos', 'Reis', 'Simões', 'Antunes', 'Matos', 'Fonseca',
  'Tavares', 'Barbosa', 'Morais', 'Baptista', 'Machado', 'Brito', 'Faria', 'Valente', 'Castro', 'Freitas',
]

export const NOMES_BR = ['Wellington', 'Thiago', 'Lucas', 'Gabriel', 'Matheus', 'Felipe', 'Everton', 'Danilo', 'Rafinha', 'Caio', 'Igor', 'Vinícius']
export const APELIDOS_BR = ['Souza', 'Lima', 'Araújo', 'Barros', 'Nascimento', 'Moura', 'Batista', 'Dias', 'Freire', 'Rezende']

export const NOMES_AF = ['Mamadu', 'Ivanildo', 'Edson', 'Nélson', 'Adilson', 'Djalmir', 'Kelvin', 'Yannick', 'Abel', 'Zé Luís']
export const APELIDOS_AF = ['Baldé', 'Semedo', 'Tavares', 'Mendes', 'Fortes', 'Cabral', 'Embaló', 'Sanhá', 'Lopes', 'Varela']

export const NOMES_ES = ['Javier', 'Sergio', 'Álvaro', 'Pablo', 'Iker', 'Marcos', 'Unai', 'Adrián']
export const APELIDOS_ES = ['García', 'Martínez', 'López', 'Sánchez', 'Romero', 'Navarro', 'Torres', 'Iglesias']

/** Pares de cores (principal, secundária). */
export const CORES: [string, string][] = [
  ['#c8102e', '#ffffff'], ['#006a4e', '#ffffff'], ['#0047ab', '#ffffff'], ['#000000', '#ffffff'],
  ['#ffd100', '#003da5'], ['#5b2c83', '#ffffff'], ['#f47920', '#000000'], ['#7a0019', '#ffd100'],
  ['#00843d', '#ffd100'], ['#1d428a', '#c8102e'], ['#ffffff', '#c8102e'], ['#ffffff', '#0047ab'],
  ['#87ceeb', '#ffffff'], ['#8b4513', '#ffffff'], ['#2e2e2e', '#ffd100'], ['#e30613', '#000000'],
]

export const NOMES_ESTADIO = [
  'Estádio Municipal de {T}', 'Estádio da Luzinha', 'Campo do Bairro Alto', 'Estádio do Montinho', 'Parque dos Desportos de {T}',
  'Estádio José Valente', 'Campo da Mata', 'Estádio do Ribeirinho', 'Estádio da Cerca', 'Campo Joaquim Pires',
] as const
