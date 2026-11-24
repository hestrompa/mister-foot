// Novidades das últimas versões, no ecrã inicial (acrescentar no topo a cada versão).
import { useState } from 'react'

export const NOVIDADES: { data: string; itens: string[] }[] = [
  {
    data: '24/11',
    itens: [
      'Dinheiro no arranque de cada época: direitos de TV, patrocinador, lugares anuais e prémio da Liga pela classificação.',
      'Verba da direção no arranque, ligada à confiança; investidores entram a meio da época em clubes que superam o esperado.',
      'Patrocínio por objetivos (arriscar antes da 1.ª jornada) e venda do nome do estádio.',
      'Separador Clube: contas da época, previsão da caixa até ao fim da época e épocas anteriores.',
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
