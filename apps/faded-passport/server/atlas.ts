// The Atlas client, imported by relative path on purpose: Vercel compiles traced relative .ts files
// (and rewrites their imports to .js) but not a workspace package whose exports point at .ts source.
// `pnpm export` rewrites this path to the vendored copy.
export * from "../../../packages/atlas-client/src/index.ts";
