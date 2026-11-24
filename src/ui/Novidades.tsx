// Novidades das últimas versões, no ecrã inicial (acrescentar no topo a cada versão).
import { useState } from 'react'

export const NOVIDADES: { data: string; itens: string[] }[] = [
  {
    data: '24/11',
    itens: [
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
