import { normalizeDomain } from "./core.js";
const site = new URLSearchParams(location.search).get("site");
try {
  if (site)
    document.querySelector("#blocked-site").textContent = normalizeDomain(site);
} catch {
  /* Never display untrusted URL input. */
}
