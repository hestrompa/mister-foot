// Cópia de segurança: descarregar a carreira para um ficheiro e voltar a abri-la (noutro aparelho ou depois de limpar o browser).
import { useRef, useState } from 'react'
import type { Jogo } from '../core/types'
import { exportarTexto, importarTexto } from '../jogo/gravar'

export function descarregarCopia(jogo: Jogo): void {
  try {
    const clube = jogo.mundo.clubes[jogo.clubeId]
    const nome = `mister-foot-${(clube?.sigla ?? 'carreira').toLowerCase()}-${jogo.mundo.epoca}.json`
    const url = URL.createObjectURL(new Blob([exportarTexto(jogo)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = nome
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  } catch { /* sem descarga neste browser */ }
}

/** Botão para abrir uma cópia de segurança (ecrã inicial). */
export function AbrirCopia({ temJogo, aberto }: { temJogo: boolean; aberto: () => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const [erro, setErro] = useState('')
  return (
    <div className="abrir-copia">
      <button type="button" className="botao" onClick={() => ref.current?.click()}>Abrir cópia de segurança</button>
      <input ref={ref} type="file" accept=".json,application/json" hidden aria-label="Ficheiro da cópia de segurança" onChange={async (e) => {
        const f = e.target.files?.[0]
        e.target.value = ''
        if (!f) return
        if (temJogo && !confirm('Abrir esta cópia substitui a carreira atual. Continuar?')) return
        const msg = importarTexto(await f.text())
        if (msg) setErro(msg)
        else { setErro(''); aberto() }
      }} />
      {erro && <p className="erro" role="alert">{erro}</p>}
    </div>
  )
}
