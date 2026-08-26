import { useState } from 'react'

/**
 * Ancho que se descarga realmente. El logo se ve a 16-18px, así que 48px
 * cubre pantallas de hasta 3x de densidad sin traerse el original (128 o
 * 200px, hasta 25 KB) que habría que decodificar entero en memoria.
 */
const REQUESTED_WIDTH = 48

type Stage = 'optimized' | 'proxy' | 'failed'

/**
 * Logo de una empresa, servido siempre desde nuestro propio origen: hay
 * redes (p.ej. corporativas) que bloquean la conexión del navegador a los
 * dominios de los proveedores aunque nuestras funciones sí lleguen.
 *
 * Se pide primero al optimizador de imágenes de Vercel, que lo reescala y lo
 * convierte a WebP. Si no estuviera disponible (en desarrollo no existe) se
 * cae al proxy propio, que devuelve la imagen original; y si tampoco, el
 * logo desaparece sin dejar hueco en vez de mostrar un icono roto.
 */
export function SymbolLogo({ url, size, className }: { url: string; size: number; className: string }) {
  const [stage, setStage] = useState<Stage>('optimized')

  if (stage === 'failed') return null

  const src =
    stage === 'optimized'
      ? `/_vercel/image?url=${encodeURIComponent(url)}&w=${REQUESTED_WIDTH}&q=75`
      : `/api/logo?src=${encodeURIComponent(url)}`

  return (
    <img
      // La key fuerza a recrear el <img> al cambiar de fuente: sin ella el
      // navegador puede no reintentar la carga con el nuevo src.
      key={stage}
      src={src}
      alt=""
      className={className}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setStage(stage === 'optimized' ? 'proxy' : 'failed')}
    />
  )
}
