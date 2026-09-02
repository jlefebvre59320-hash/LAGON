import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    // Ces états hydratent des API exclusivement navigateur (session, stockage
    // local, installation PWA) ou lancent des chargements annulables. Les
    // déplacer artificiellement dans un timer dégraderait leur comportement.
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
  globalIgnores([".next/**", "node_modules/**", "coverage/**", "public/sw.js", "next-env.d.ts"]),
]);
