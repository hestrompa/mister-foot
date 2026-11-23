// Primeiros passos: uma dica curta por separador, até o jogador a fechar. Fica guardado no browser.
import { useState } from 'react'
import './dicas.css'

const CHAVE = 'mister-foot:dicas'

/** Dica de cada separador (chave = separador). Separadores sem dica não mostram nada. */
export const DICAS: Record<string, { titulo: string; texto: string }> = {
  jogo: {
    titulo: 'Primeiros passos',
    texto: 'Escolhe a formação e a postura, vê na antevisão como encaixas no adversário e carrega em Jogar jornada. Durante o jogo podes mudar a postura e fazer até 5 substituições.',
  },
  plantel: {
    titulo: 'O teu plantel',
    texto: 'A força vai de 1 a 99. Os jovens crescem até ao potencial; a partir dos 30 anos começam a perder força. Toca no cabeçalho de uma coluna para ordenar.',
  },
  balneario: {
    titulo: 'Balneário',
    texto: 'Cada jogador tem moral e cansaço. Quem espera jogar e fica no banco desanima; quem joga sem parar cansa e lesiona-se mais. Escolhe o capitão, cumpre as promessas e responde aos conflitos antes da jornada seguinte.',
  },
  mercado: {
    titulo: 'Mercado',
    texto: 'Só compras e vendes com a janela aberta. Vê o salário que o jogador pede: a massa salarial paga-se todas as jornadas, ganhes ou percas.',
  },
  taca: {
    titulo: 'Taça',
    texto: 'Os jogos da Taça são a eliminar e metem-se entre as jornadas. Ir longe dá prémios em dinheiro.',
  },
  europa: {
    titulo: 'Europa',
    texto: 'Os 2 primeiros da 1.ª Divisão vão à Liga Continental; o 3.º, o 4.º e o vencedor da Taça vão à Taça Continental. Jogos a meio da semana, sem salários, com prémios e bilheteira.',
  },
  classificacao: {
    titulo: 'Classificação',
    texto: 'Os 3 primeiros sobem e os 3 últimos descem. Na 1.ª divisão, o primeiro é campeão.',
  },
  clube: {
    titulo: 'O teu clube',
    texto: 'Bilhete mais caro rende mais por adepto, mas vai menos gente. Se o estádio enche, aumentá-lo traz mais receita; o banco empresta, mas cobra juros todas as jornadas.',
  },
  divisoes: {
    titulo: 'Divisões',
    texto: 'Toca num clube para espreitar o plantel: é aí que encontras reforços para o mercado.',
  },
}

function ler(): { fechadas: string[]; todas: boolean } {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) ?? 'null')
    if (v && Array.isArray(v.fechadas)) return { fechadas: v.fechadas, todas: !!v.todas }
  } catch { /* sem armazenamento */ }
  return { fechadas: [], todas: false }
}

function guardar(v: { fechadas: string[]; todas: boolean }) {
  try { localStorage.setItem(CHAVE, JSON.stringify(v)) } catch { /* ignora */ }
}

export function Dicas({ sep }: { sep: string }) {
  const [estado, setEstado] = useState(ler)
  const d = DICAS[sep]
  if (!d || estado.todas || estado.fechadas.includes(sep)) return null
  const mudar = (v: typeof estado) => { guardar(v); setEstado(v) }
  return (
    <aside className="cartao dica-cartao" aria-label={d.titulo}>
      <div className="dica-texto">
        <b>{d.titulo}</b>
        <span>{d.texto}</span>
      </div>
      <div className="dica-botoes">
        <button className="botao" onClick={() => mudar({ ...estado, fechadas: [...estado.fechadas, sep] })}>Percebido</button>
        <button className="botao fantasma" onClick={() => mudar({ ...estado, todas: true })}>Esconder todas as dicas</button>
      </div>
    </aside>
  )
}
