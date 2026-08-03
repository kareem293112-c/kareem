const puppeteer = require("puppeteer");
(async () => {
  const browser = await puppeteer.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  const page = await browser.newPage();
  page.on("console", msg => console.log("PAGE LOG:", msg.text()));
  page.on("pageerror", err => console.log("PAGE ERROR:", err.toString()));
  await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
  await new Promise(r => setTimeout(r, 2000));
  const errorDivText = await page.evaluate(() => {
    const divs = Array.from(document.querySelectorAll("div"));
    const errDiv = divs.find(d => d.style.backgroundColor === "red" || d.style.backgroundColor === "orange");
    return errDiv ? errDiv.innerText : null;
  });
  if (errorDivText) console.log("ONERROR DIV:", errorDivText);
  await browser.close();
})();
