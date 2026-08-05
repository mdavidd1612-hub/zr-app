import { defineConfig } from 'vitest/config'
import { config } from 'dotenv'

// Las pruebas hablan con la base de Supabase local, así que necesitan las mismas
// claves que la aplicación. Se leen de .env.local, que nunca se sube al repo.
config({ path: '.env.local' })

export default defineConfig({
  test: {
    environment: 'node',
    // Las pruebas de acceso cruzado inician sesión con usuarios distintos contra
    // la misma base. Si corrieran en paralelo se pisarían las sesiones y darían
    // falsos verdes — que en este proyecto significa dar por segura una fuga de
    // datos de menores de edad. Por eso van de una en una.
    fileParallelism: false,
    testTimeout: 20_000,
    include: ['tests/**/*.test.ts'],
  },
})
