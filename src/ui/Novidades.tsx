// Novidades das últimas versões, no ecrã inicial (acrescentar no topo a cada versão).
import { useState } from 'react'

export const NOVIDADES: { data: string; itens: string[] }[] = [
  {
    data: '27/11',
    itens: [
      'Staff mais fundo: treinadores de setor opcionais (defesas, médios, avançados) que aceleram a evolução da sua posição e puxam pelo que ela mais pede.',
      'Intensidade do treino (leve, normal, forte): mais evolução ou mais descanso, com o cansaço e o risco de lesão a acompanhar.',
      'Treino individual para até 5 jogadores: puxar um atributo, ou aprender uma posição nova (um médio que aprende a defesa passa de 74% para 94% do rendimento lá).',
      'Olheiro em missão: escolhe a região (Portugal, Brasil, África lusófona, resto da Europa) e a posição, e ele vai encontrando talentos de 16 a 20 anos que se podem contratar durante 6 jornadas.',
      'Campeonatos de Espanha e Inglaterra nos jogos novos: 2 divisões de 18 clubes em cada país, com calendário completo de 34 jornadas, 3 subidas e 3 descidas e todos os jogos simulados pelo mesmo motor. Podes começar lá, ver as divisões e as classificações de cada país (separadores Divisões e Classificação), comprar e vender jogadores entre países e receber convites de clubes estrangeiros.',
      'Na Europa entram os 2 primeiros da 1.ª de Espanha e de Inglaterra na Liga Continental e o 3.º e o 4.º na Taça Continental, no lugar dos clubes inventados desses países. A Taça Nacional continua a ser só de Portugal. As gravações antigas ficam como estavam (só Portugal).',
      'Campo tático: arrasta cada jogador para onde queres que jogue, no pré-jogo e durante o jogo (Pausa, Equipa ou intervalo). Um médio mais recuado defende mais e ataca menos, um mais adiantado o contrário, um avançado que recua ajuda o meio-campo e um lateral que sobe dá saída de bola. Quem passa para outra zona muda de papel e a formação muda com ele (ex.: 4-4-2 para 4-3-3). As formações do menu continuam como atalho.',
      'O motor usa as posições: o ganho depende dos atributos de quem mudas (remate e velocidade para subir, defesa para recuar), e uma forma toda à frente ou toda atrás perde mais do que ganha. As percentagens por baixo do campo mostram logo o que muda no meio-campo, no ataque e na defesa.',
      'O campo 2D mostra as caricas nas posições que escolheste, e os lances nascem no corredor de quem os cria. Cada mudança a meio do jogo fica no relato.',
      'Adeptos com humor (de furiosos a euforia), visível no separador Imprensa e no Clube: sobe e desce com os resultados face ao esperado, pesa mais nos dérbis, castiga bilhetes muito caros e a venda da figura da equipa, e volta devagar ao normal.',
      'Bilheteira ligada aos adeptos: contentes trazem até 20% mais gente ao estádio e compram mais lugares anuais no verão; furiosos tiram até 20%. Títulos e subidas deixam festa para a época seguinte; descidas deixam mágoa.',
      'Pressão das bancadas: com os adeptos furiosos há lenços brancos, assobios que tiram moral em casa e a direção perde confiança jogo a jogo; em euforia o estádio dá moral e a direção agradece.',
      'Conferência de imprensa também depois de cada jogo (vitória, empate, derrota, goleada, dérbi), e novas perguntas antes do jogo sobre os assobios e o preço dos bilhetes. Cada resposta mostra o efeito na moral, na direção e nos adeptos; promessas cumpridas ou falhadas também contam para os adeptos.',
    ],
  },
  {
    data: '25/11',
    itens: [
      'Cartões à vista durante o jogo: quem tem amarelo leva um cartãozinho junto da carica no campo 2D, e as notas ao vivo e o painel Equipa mostram o amarelo, o segundo amarelo e o vermelho ao lado do nome. Tudo vem da mesma conta do árbitro e segue o jogador em substituições, mudanças de formação, prolongamento, taça e Europa.',
      'Nota de 0 a 10 para cada jogador em cada jogo, como nos jornais: golos, assistências, remates, passes para remate, desarmes, defesas, erros, cartões, golos sofridos e o resultado, com pesos por posição. Vê-se ao vivo (para decidir substituições), no resumo com o melhor em campo, na ficha do jogo, e a média da época no plantel, no pré-jogo, no mercado e na carreira de cada jogador.',
      'A nota conta: uma grande exibição sobe a moral e uma má tira; a média da época mexe no valor de mercado (até 15%).',
      'Ecrãs de gestão sem scroll da página: cabeçalho, menu e botão de jogar sempre à vista. No computador o separador Jogo mostra o onze, a tática e o adversário e os avisos lado a lado; no telemóvel ficam em abas (Avisos, Onze, Tática e adversário). Balneário e Staff em colunas, Calendário em duas metades, tabelas mais compactas.',
      'Jogo ao vivo em ecrã inteiro e sem scroll: no computador relato, campo e tabela lado a lado; no tablet e no telemóvel o campo encaixa no espaço livre e o relato, os jogos e a tabela ficam em abas. Com o telemóvel deitado, o campo ocupa a altura toda.',
      'Os outros ecrãs usam a largura toda: menu de separadores sempre visível no topo, pré-jogo em duas colunas e ecrã inicial em duas colunas em ecrãs largos.',
    ],
  },
  {
    data: '24/11',
    itens: [
      'Quem pega numa equipa a meio da época tem 10 jornadas de graça antes de poder ser despedido. Dicas novas para Staff, Carreira, Imprensa e Calendário.',
      'Botão de jogar nunca fica preso: castigados da taça e da Europa saem do onze sozinhos, sobem juniores de urgência se não houver onze, e a IA já não leva por cláusula o teu penúltimo guarda-redes.',
      'Cartões e lesões no campo 2D: a falta, o árbitro a mostrar o cartão (o expulso sai), ou o jogador no chão e a equipa médica a entrar. Nas repetições, o canto curto, ao segundo poste ou à entrada da área, o livre cruzado e a marcação individual aparecem como foram escolhidos no plano de jogo.',
      'Plano de jogo no pré-jogo: marcação (à zona, individual ou pressão alta), cantos ensaiados (à área, curto ou à entrada da área), livres diretos ou cruzados, batedor e instruções individuais (apoiar o ataque, ficar atrás, rematar de longe, marcar de perto um adversário). Tudo pesa conforme os atributos dos jogadores. A marcação também se muda ao intervalo.',
      'Relatório do olheiro sobre o próximo adversário: jogadores-chave, como costumam jogar e ideias que se aplicam com um toque. Quanto melhor o olheiro, mais o relatório diz.',
      'Campo 2D com os atributos: os rápidos correm mais, os bons passadores arriscam o passe longo, os bons defesas desarmam mais, remates mais fortes e guarda-redes melhores a mergulhar. Mais lances ao vivo: desarmes, cortes, lançamentos, alívios, cantos aliviados de cabeça e remates bloqueados ou ao lado.',
      'Carreira dos jogadores: personalidade (profissional, ambicioso, leal, temperamental, líder...), histórico de jogos e golos por época, reformas entre os 33 e os 39 anos e galeria de lendas na História.',
      'Evolução mais natural: jovens com teto alto crescem mais, os minutos contam no potencial e há quem floresça tarde.',
      'Academia de juniores com níveis: investe no separador Mercado > Juniores para juniores melhores.',
      'Taça, Supertaça e Europa com campo 2D ao vivo e repetições, como na liga; corrigido o ecrã que podia ficar preso no fim destes jogos.',
      'Dinheiro no arranque de cada época: direitos de TV, patrocinador, lugares anuais e prémio da Liga pela classificação.',
      'Verba da direção no arranque, ligada à confiança; investidores entram a meio da época em clubes que superam o esperado.',
      'Patrocínio por objetivos (arriscar antes da 1.ª jornada) e venda do nome do estádio.',
      'Separador Clube: contas da época, previsão da caixa até ao fim da época (com aviso se acabar no vermelho), épocas anteriores e comparação com a divisão.',
      'Prémios de jogo no Balneário, contrapropostas no mercado e escolha da pré-época (digressão ou estágio).',
      'Conquistas da carreira, treinador do mês e cópia de segurança da carreira num ficheiro.',
      'Atributos dos jogadores, 2D com mais vida e épocas mais equilibradas.',
    ],
  },
]

export function Novidades() {
  const [aberto, setAberto] = useState(false)
  const [ultima] = NOVIDADES
  const itens = aberto ? ultima.itens : ultima.itens.slice(0, 3)
  return (
    <div className="cartao novidades" aria-label="Novidades">
      <h2>Novidades · {ultima.data}</h2>
      <ul>{itens.map((t) => <li key={t}>{t}</li>)}</ul>
      {ultima.itens.length > 3 && <button type="button" className="botao fantasma" onClick={() => setAberto(!aberto)}>{aberto ? 'Ver menos' : `Ver todas (${ultima.itens.length})`}</button>}
    </div>
  )
}
