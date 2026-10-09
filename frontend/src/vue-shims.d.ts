/**
 * Fallback declaration for `*.vue` imports.
 *
 * It exists only for tooling that runs on plain `tsc` — here, the type-aware
 * ESLint rules, which use the stock TypeScript package and cannot parse Single
 * File Components. Without it those imports would be typed as `error`, and the
 * `no-unsafe-*` rules would flag every use of a component.
 *
 * `vue-tsc`, which runs the real type check, resolves the actual `.vue` files
 * and never falls back to this declaration, so component props stay fully typed.
 */
declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent;
  export default component;
}
