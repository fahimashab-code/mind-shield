import { readFileSync, existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
assert.equal(manifest.manifest_version, 3);
for (const path of [
  manifest.background.service_worker,
  manifest.action.default_popup,
  manifest.options_page,
  ...Object.values(manifest.icons),
  ...manifest.web_accessible_resources.flatMap((entry) => entry.resources),
]) {
  assert.ok(existsSync(path), `Missing manifest resource: ${path}`);
}
for (const name of readdirSync(".").filter((name) => name.endsWith(".js")))
  execFileSync(process.execPath, ["--check", name]);
for (const name of readdirSync(".").filter((name) => name.endsWith(".html"))) {
  const html = readFileSync(name, "utf8");
  assert.ok(
    !/\son\w+\s*=/.test(html),
    `${name}: inline event handlers are not allowed`,
  );
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const target = match[1];
    if (!target.startsWith("#"))
      assert.ok(existsSync(target), `${name}: missing ${target}`);
  }
}
console.log(
  "Manifest resources, JavaScript syntax, and local HTML assets verified.",
);
