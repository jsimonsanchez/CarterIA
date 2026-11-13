import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

export interface DonutSlice {
  key: string
  value: number
  color: string
  /** Primera línea del tooltip (el nombre). */
  label: string
  /** Segunda línea del tooltip (importe, peso, rendimiento...). */
  detail: string
}

const SIZE = 130
const CENTER = SIZE / 2
const INNER = 30
const OUTER = 54
const RADIUS = (INNER + OUTER) / 2
const STROKE = OUTER - INNER
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
/** Separación entre porciones, en unidades de la circunferencia (≈1°). */
const GAP = CIRCUMFERENCE / 360

interface Tip {
  slice: DonutSlice
  /** Posición del puntero, relativa al contenedor de la gráfica. */
  x: number
  y: number
}

/** Margen mínimo entre el tooltip y el borde de la pantalla. */
const VIEWPORT_MARGIN = 8

/**
 * Tarta en anillo dibujada a mano en SVG. Sustituye a recharts, que pesaba
 * más de 300 kB para pintar dos de estas: aquí cada porción es un círculo con
 * el trazo cortado a la medida de su peso.
 *
 * El tooltip sigue al ratón; en táctil aparece al tocar una porción y se
 * cierra al tocar fuera.
 */
export function DonutChart({ slices, ariaLabel }: { slices: DonutSlice[]; ariaLabel: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<Tip | null>(null)

  // Centrado sobre el puntero, pero sin salirse de la pantalla: en móvil las
  // dos gráficas van pegadas a los bordes y un tooltip abierto hacia fuera
  // ensanchaba la página entera. Se coloca antes de pintar, ya con su ancho
  // real medido, para que no se vea saltar.
  useLayoutEffect(() => {
    const tooltip = tooltipRef.current
    const container = containerRef.current
    if (!tip || !tooltip || !container) return
    const containerLeft = container.getBoundingClientRect().left
    const width = tooltip.offsetWidth
    const minLeft = VIEWPORT_MARGIN - containerLeft
    const maxLeft = document.documentElement.clientWidth - VIEWPORT_MARGIN - width - containerLeft
    const centered = tip.x - width / 2
    tooltip.style.left = `${Math.max(minLeft, Math.min(centered, maxLeft))}px`
  }, [tip])

  useEffect(() => {
    if (!tip) return
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setTip(null)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [tip])

  const total = slices.reduce((acc, s) => acc + Math.max(0, s.value), 0)
  if (total <= 0) return null

  function show(event: ReactPointerEvent<SVGCircleElement>, slice: DonutSlice) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setTip({ slice, x: event.clientX - rect.left, y: event.clientY - rect.top })
  }

  // Con una sola porción no hay hueco que dejar: es el anillo entero.
  const visibleSlices = slices.filter((s) => s.value > 0)
  const gap = visibleSlices.length > 1 ? GAP : 0
  const arcs = visibleSlices.map((slice, i) => {
    const length = (slice.value / total) * CIRCUMFERENCE
    // Dónde empieza: lo que ocupan todas las porciones anteriores.
    const start = visibleSlices.slice(0, i).reduce((acc, s) => acc + (s.value / total) * CIRCUMFERENCE, 0)
    return { slice, visible: Math.max(length - gap, 0.5), start }
  })

  return (
    <div className="donut" ref={containerRef}>
      <svg
        width="100%"
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={ariaLabel}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') setTip(null)
        }}
      >
        <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
          {arcs.map(({ slice, visible, start }) => (
            <circle
              key={slice.key}
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke={slice.color}
              strokeWidth={STROKE}
              strokeDasharray={`${visible} ${CIRCUMFERENCE - visible}`}
              strokeDashoffset={-start}
              className={tip?.slice.key === slice.key ? 'donut-slice active' : 'donut-slice'}
              onPointerMove={(e) => show(e, slice)}
              onPointerDown={(e) => show(e, slice)}
            />
          ))}
        </g>
      </svg>
      {tip && (
        <div ref={tooltipRef} className="donut-tooltip" style={{ top: tip.y }} role="status">
          <strong>{tip.slice.label}</strong>
          <span>{tip.slice.detail}</span>
        </div>
      )}
    </div>
  )
}
