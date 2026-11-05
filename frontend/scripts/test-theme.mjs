import { chromium } from "playwright-core";

const baseUrl = "http://127.0.0.1:5173";
const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});

const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function luminance([r, g, b]) {
  const values = [r, g, b].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
}

function contrast(foreground, background) {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

async function paletteSnapshot(selector = "h1") {
  return page.locator(selector).first().evaluate((element) => {
    const rgb = (value) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const foreground = rgb(getComputedStyle(element).color);
    let current = element;
    let background = [0, 0, 0];
    while (current) {
      const style = getComputedStyle(current);
      const color = rgb(style.backgroundColor);
      const alpha = Number((style.backgroundColor.match(/[\d.]+/g) ?? [])[3] ?? 1);
      if (color.length === 3 && alpha > 0) { background = color; break; }
      current = current.parentElement;
    }
    return { foreground, background };
  });
}

async function assertTheme(route, theme, expectedDark) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
  await page.evaluate((value) => localStorage.setItem("relive-theme", value), theme);
  await page.reload({ waitUntil: "networkidle" });
  const state = await page.evaluate(() => ({
    dark: document.documentElement.classList.contains("dark"),
    stored: localStorage.getItem("relive-theme"),
    bodyBackground: getComputedStyle(document.body).backgroundColor,
  }));
  assert(state.dark === expectedDark, `${route} did not apply ${theme} theme`);
  assert(state.stored === theme, `${route} did not persist ${theme} theme`);
  assert(await page.getByRole("button", { name: expectedDark ? "Switch to light theme" : "Switch to dark theme" }).count() >= 1, `${route} is missing its accessible theme toggle`);
  const colors = await paletteSnapshot(route === "/portal" ? "h1" : "h1");
  assert(contrast(colors.foreground, colors.background) >= 4.5, `${route} ${theme} heading contrast is below 4.5:1`);
  if (expectedDark) assert(state.bodyBackground.includes("5, 5, 5"), `${route} dark body is not black/dark`);
  return `${route}:${theme}`;
}

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("relive-theme"));
  await page.reload({ waitUntil: "networkidle" });
  assert(!await page.evaluate(() => document.documentElement.classList.contains("dark")), "Default theme should be light");

  const toggle = page.getByRole("button", { name: "Switch to dark theme" }).first();
  await toggle.click();
  assert(await page.evaluate(() => document.documentElement.classList.contains("dark")), "Toggle did not activate dark theme");
  await page.reload({ waitUntil: "networkidle" });
  assert(await page.evaluate(() => document.documentElement.classList.contains("dark")), "Dark theme did not survive refresh");

  await page.getByRole("button", { name: "Log in" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  const dialogBackground = await dialog.evaluate((element) => getComputedStyle(element).backgroundColor);
  assert(dialogBackground.includes("13, 13, 15"), "Login modal did not inherit dark theme");
  await page.keyboard.press("Escape");

  const otpResponse = await context.request.post("http://127.0.0.1:4000/api/v1/auth/request-otp", {
    data: { mobile: "9876543210", consent: true, consentVersion: "login-v1", channel: "SMS" },
  });
  assert(otpResponse.ok(), `OTP setup failed: ${otpResponse.status()}`);
  const otp = await otpResponse.json();
  const verifyResponse = await context.request.post("http://127.0.0.1:4000/api/v1/auth/verify-otp", {
    data: { transactionId: otp.transactionId, otp: otp.devOtp },
  });
  assert(verifyResponse.ok(), `OTP verification failed: ${verifyResponse.status()}`);

  const routes = ["/", "/privacy", "/terms", "/portal"];
  const results = [];
  for (const route of routes) {
    results.push(await assertTheme(route, "light", false));
    results.push(await assertTheme(route, "dark", true));
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.setItem("relive-theme", "dark"));
  await page.reload({ waitUntil: "networkidle" });
  assert(await page.getByRole("button", { name: "Switch to light theme" }).count() >= 1, "Mobile header toggle is unavailable");

  console.log(`Theme browser checks passed (${results.length + 4} assertions groups): ${results.join(", ")}, modal, refresh, default, mobile`);
} finally {
  await browser.close();
}
