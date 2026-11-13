import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

/**
 * Vercel solo llega al registro público de npm. Si un paquete se instala
 * desde un equipo cuyo npm apunta a un proxy privado (p.ej. por la variable
 * de entorno NPM_CONFIG_REGISTRY, que se impone al .npmrc del proyecto), el
 * lockfile guarda la dirección de ese proxy y el despliegue falla en
 * `npm install`. Ya ha pasado dos veces.
 */
describe('package-lock.json', () => {
  it('solo resuelve paquetes contra el registro público de npm', () => {
    const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8')) as {
      packages: Record<string, { resolved?: string }>
    }

    const fuera = Object.entries(lock.packages)
      .filter(([, pkg]) => pkg.resolved && !pkg.resolved.startsWith('https://registry.npmjs.org/'))
      .map(([name, pkg]) => `${name} -> ${pkg.resolved}`)

    assert.deepEqual(fuera, [], 'Cambia esas URLs a https://registry.npmjs.org/ antes de subir')
  })
})
