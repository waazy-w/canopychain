// Browser end-to-end test of the CanopyChain dApp against a local Hardhat chain + real backend.
// A tiny EIP-1193 shim stands in for MetaMask: it forwards to the Hardhat node, whose test
// accounts are unlocked, so eth_sendTransaction is signed by the node itself.
// Setup and usage: see "Browser end-to-end test" in frontend/README.md. Screenshots go to e2e/shots/.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const SHOTS = path.join(path.dirname(fileURLToPath(import.meta.url)), "shots");
fs.rmSync(SHOTS, { recursive: true, force: true });
fs.mkdirSync(SHOTS);
const ACCOUNT = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"; // Hardhat test account #2

const log = [];
const note = (m) => {
  console.log(m);
  log.push(m);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
await ctx.addInitScript(({ account }) => {
  const listeners = {};
  let id = 0;
  const rpc = async (method, params) => {
    const res = await fetch("http://127.0.0.1:8545", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params: params ?? [] }),
    });
    const json = await res.json();
    if (json.error) throw Object.assign(new Error(json.error.message), { code: json.error.code, data: json.error.data });
    return json.result;
  };
  window.ethereum = {
    isMetaMask: true,
    async request({ method, params }) {
      switch (method) {
        case "eth_requestAccounts":
        case "eth_accounts":
          return [account];
        case "eth_chainId":
          return "0x7a69";
        case "net_version":
          return "31337";
        case "wallet_switchEthereumChain":
        case "wallet_addEthereumChain":
        case "wallet_watchAsset":
          return null;
        case "wallet_requestPermissions":
        case "wallet_getPermissions":
          return [{ parentCapability: "eth_accounts" }];
        default:
          return rpc(method, params);
      }
    },
    on(evt, fn) {
      (listeners[evt] ??= []).push(fn);
    },
    removeListener(evt, fn) {
      listeners[evt] = (listeners[evt] ?? []).filter((f) => f !== fn);
    },
  };
}, { account: ACCOUNT });

const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(`[${page.url()}] ${m.text()}`));
page.on("pageerror", (e) => consoleErrors.push(`[${page.url()}] PAGEERROR ${e.message}`));
page.on("dialog", (d) => d.accept());
const shot = async (name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });

try {
  // 1. Landing + connect wallet
  await page.goto(BASE + "/");
  await page.waitForLoadState("networkidle");
  await shot("01-landing");
  const connectBtn = page.getByRole("button", { name: /connect wallet/i }).first();
  if (await connectBtn.isVisible().catch(() => false)) {
    await connectBtn.click();
    await page.getByText(/browser wallet|metamask|injected/i).first().click();
  }
  await page.waitForTimeout(1500);
  const connected = await page.getByText(/0x3C/i).first().isVisible().catch(() => false);
  note(`wallet connected: ${connected}`);

  // 2. Register: zoom in on the Amazon and draw a rectangle
  await page.goto(BASE + "/register");
  await page.waitForSelector(".leaflet-container");
  for (let i = 0; i < 8; i++) {
    await page.click(".leaflet-control-zoom-in");
    await page.waitForTimeout(350);
  }
  await page.waitForTimeout(1500);
  await page.click(".leaflet-pm-icon-rectangle");
  const box = await page.locator(".leaflet-container").boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.click(cx - 80, cy - 80);
  await page.mouse.click(cx + 80, cy + 80);
  await page.getByPlaceholder(/Mata Atl/).fill("E2E Amazon Block");
  await page.waitForTimeout(500);
  const ownerValue = await page.getByPlaceholder(/defaults to your connected wallet/).inputValue();
  const areaText = await page.getByText(/Area:/).locator("..").innerText();
  note(`register form: owner="${ownerValue}" ${areaText.replace(/\s+/g, " ")}`);
  await shot("02-register");
  await page.getByRole("button", { name: "Register project" }).click();
  await page.waitForURL(/\/projects\/\d+/, { timeout: 30_000 });
  const projectUrl = page.url();
  note(`registered → ${projectUrl}`);

  // 3. Run verification (live Planetary Computer fetch)
  const t0 = Date.now();
  await page.getByRole("button", { name: "Run verification" }).click();
  await page.getByText(/^Report$/).or(page.locator("text=Report hash")).first().waitFor({ timeout: 240_000 });
  note(`verification finished in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await page.waitForTimeout(2500); // let on-chain reads refresh
  await shot("03-verified");

  // 4. Verify report integrity
  await page.getByRole("button", { name: "Verify this report" }).click();
  const verdict1 = page.locator("p.rounded-md.border").filter({ hasText: /Verified|Mismatch|intact|changed|Check failed/ });
  await verdict1.first().waitFor({ timeout: 30_000 });
  note(`integrity (verification): ${await verdict1.first().innerText()}`);
  await shot("04-integrity-verified");

  // 5. Retire 10 credits
  const amountInput = page.locator("label:has-text('Amount') input");
  await amountInput.waitFor({ timeout: 30_000 });
  await amountInput.fill("10");
  await page.getByPlaceholder("Who the offset is claimed for").fill("Acme Corp");
  await page.getByPlaceholder("e.g. 2026 business travel").fill("E2E browser test");
  await page.getByRole("button", { name: /^Retire 10/ }).click();
  await page.waitForURL(/\/certificates\/\d+/, { timeout: 60_000 });
  await page.getByText("Acme Corp").first().waitFor({ timeout: 30_000 });
  note(`certificate → ${page.url()}`);
  await shot("05-certificate");

  // 6. Simulate deforestation → reversal
  await page.goto(projectUrl);
  await page.getByRole("button", { name: "Simulate deforestation" }).click();
  await page.getByText(/Reversal (flagged|detected)/).first().waitFor({ timeout: 240_000 });
  await page.waitForTimeout(2500);
  await shot("06-reversal");
  await page.getByRole("button", { name: "Verify this report" }).click();
  const verdict2 = page.locator("p.rounded-md.border").filter({ hasText: /Verified|Mismatch|intact|changed|Check failed/ });
  await verdict2.first().waitFor({ timeout: 30_000 });
  note(`integrity (reversal): ${await verdict2.first().innerText()}`);
  await shot("07-integrity-reversal");

  // 7. Registry
  await page.goto(BASE + "/registry");
  await page.getByText(/ReversalFlagged|Reversal/).first().waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1500);
  await shot("08-registry");
  note("registry loaded");
} catch (err) {
  note(`FAILED at ${page.url()}: ${err.message.split("\n")[0]}`);
  await shot("99-failure");
} finally {
  note(`console errors: ${consoleErrors.length}`);
  if (log.some((l) => l.startsWith("FAILED")) || consoleErrors.length) process.exitCode = 1;
  for (const e of consoleErrors.slice(0, 30)) note(`  ${e.slice(0, 300)}`);
  fs.writeFileSync(path.join(SHOTS, "log.txt"), log.join("\n"));
  await browser.close();
}
