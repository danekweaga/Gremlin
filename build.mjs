import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL(".", import.meta.url));
const source = join(root, "public");
const target = join(root, "dist");
const clientTarget = join(target, "client");
const serverTarget = join(target, "server");

await rm(target, { recursive: true, force: true });
await mkdir(clientTarget, { recursive: true });
await mkdir(serverTarget, { recursive: true });
await cp(source, clientTarget, { recursive: true });
await cp(source, target, { recursive: true });
await cp(join(root, "worker-site.mjs"), join(serverTarget, "index.js"));
await cp(join(root, "lib", "analysis.mjs"), join(serverTarget, "analysis.mjs"));

console.log("Gremlin production assets and worker built in dist/.");
