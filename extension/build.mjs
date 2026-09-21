// Bundles the extension into dist/. Configure with API_BASE and WEB_BASE env vars.
import { build } from "esbuild";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const strip = (u) => u.replace(/\/+$/, "");
const API_BASE = strip(process.env.API_BASE ?? "http://localhost:8000");
const WEB_BASE = strip(process.env.WEB_BASE ?? API_BASE);
const origin = (u) => new URL(u).origin + "/*";

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });

await build({
  entryPoints: { background: "src/background.ts", content: "src/content.ts", popup: "src/popup.ts" },
  outdir: "dist", bundle: true, format: "iife", target: "chrome120", minify: false, sourcemap: false,
  define: { __API_BASE__: JSON.stringify(API_BASE), __WEB_BASE__: JSON.stringify(WEB_BASE) },
});

const manifest = JSON.parse(readFileSync("public/manifest.json", "utf8"));
manifest.host_permissions = [...new Set([origin(API_BASE)])];
writeFileSync("dist/manifest.json", JSON.stringify(manifest, null, 2));
cpSync("public/popup.html", "dist/popup.html");
cpSync("public/popup.css", "dist/popup.css");
cpSync("public/icons", "dist/icons", { recursive: true });
console.log(`Built extension → dist/  (API: ${API_BASE}, web: ${WEB_BASE})`);
