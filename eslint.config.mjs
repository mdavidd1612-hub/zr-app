import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Artefactos que genera el CLI de Supabase al levantar el entorno local.
    // Incluye el runtime de Edge Functions ya empaquetado y minificado; no es
    // código nuestro y llenaba `npm run lint` de 154 errores ajenos.
    "supabase/.temp/**",
    // Se genera con `npm run db:types` a partir del esquema real. No se edita
    // a mano, así que tampoco se le pasa el linter.
    "lib/database.types.ts",
  ]),
]);

export default eslintConfig;
