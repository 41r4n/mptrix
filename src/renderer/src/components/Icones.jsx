// ÍCONES DA CASA — desenhados, nunca emoji.
//
// Emoji quebra a lei do app: o documento manda destaque ÚNICO em lima e nada
// de cor solta, e cada emoji chega com a paleta dele. Ainda muda de desenho
// conforme o Windows, então nem a espessura do traço a gente controla.
//
// Todos aqui são traço de 1.7, sem preenchimento, herdando a cor de quem os
// contém (currentColor). Desenhados no código porque o app é 100% offline —
// fonte de ícone vinda de CDN está fora de questão.

const D = {
  // formatos
  music: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
  playlist: <><path d="M21 15V6" /><circle cx="18" cy="16" r="3" /><path d="M12 12H3M16 6H3M12 18H3" /></>,
  fast: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
  audio_m4a: <path d="M2 13a2 2 0 0 0 2-2V7a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0V4a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0v-4a2 2 0 0 1 2-2" />,
  audio_wav: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  video: <><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M7 3v18M17 3v18M3 12h18M3 7.5h4M3 16.5h4M17 7.5h4M17 16.5h4" /></>,

  // ações
  studio: <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />,
  rapido: <><path d="m12 14 4-4" /><path d="M3.34 19a10 10 0 1 1 17.32 0" /></>,
  tocar: <path d="M6 4v16l13-8z" />,
  pasta: <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />,
  renomear: <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />,
  trancado: <><rect width="18" height="11" x="3" y="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  destrancado: <><rect width="18" height="11" x="3" y="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></>,
  apagar: <path d="M18 6 6 18M6 6l12 12" />,
  buscar: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
  baixar: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />,
  calendario: <><rect width="18" height="17" x="3" y="4" rx="2" /><path d="M3 10h18M8 2v4M16 2v4" /></>
}

export default function Ico({ nome, tamanho = 20 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={tamanho}
      height={tamanho}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {D[nome] || D.baixar}
    </svg>
  )
}
