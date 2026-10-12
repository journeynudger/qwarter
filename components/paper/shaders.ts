/**
 * The Paper shaders this site may draw, and only those.
 *
 * `import("@paper-design/shaders-react")` pulls in the whole library (about thirty
 * shaders), because a dynamic import of a package cannot be tree-shaken. Naming them
 * here as static imports lets the bundler drop the rest (the package declares
 * `sideEffects: false`), and paper-shaders.tsx lazy-loads this file instead.
 * The same arrangement as Verowater's components/sections/water-shaders.ts.
 */
export { GrainGradient, MeshGradient, PaperTexture, Water } from "@paper-design/shaders-react";
