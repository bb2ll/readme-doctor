const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");

const elements = new Map();

function createElement(selector) {
  if (!elements.has(selector)) {
    elements.set(selector, {
      textContent: "",
      innerHTML: "",
      value: "",
      files: [],
      dataset: {},
      style: {},
      href: "",
      download: "",
      classList: {
        add() {},
        remove() {},
        toggle() {},
      },
      setAttribute() {},
      addEventListener() {},
      click() {},
    });
  }

  return elements.get(selector);
}

const context = {
  document: {
    querySelector: createElement,
    querySelectorAll: () => [
      { dataset: { tab: "checks" }, classList: { toggle() {} }, setAttribute() {}, addEventListener() {} },
      { dataset: { tab: "rewrite" }, classList: { toggle() {} }, setAttribute() {}, addEventListener() {} },
      { dataset: { tab: "publish" }, classList: { toggle() {} }, setAttribute() {}, addEventListener() {} },
    ],
    createElement: () => createElement("dynamic-link"),
  },
  localStorage: {
    getItem: () => "",
    setItem() {},
    removeItem() {},
  },
  navigator: {
    clipboard: {
      writeText: async () => {},
    },
  },
  Blob,
  URL: {
    createObjectURL: () => "blob:test",
    revokeObjectURL() {},
  },
  FileReader: function FileReader() {},
  fetch: async () => ({ ok: false }),
  setTimeout,
};

vm.createContext(context);
vm.runInContext(appSource, context);

const completeReadme = `# Tiny Invoice

Tiny Invoice is a browser-based invoice generator for freelancers who need to create a clean invoice quickly without signing up for another service.

## Demo

https://example.com/tiny-invoice

## Features

- Create invoices with client details, line items, taxes, and notes.
- Export invoices as print-ready PDF files.
- Track draft, sent, and paid invoices in local storage.

## Tech Stack

- HTML
- CSS
- JavaScript

## Getting Started

\`\`\`bash
git clone https://github.com/example/tiny-invoice.git
cd tiny-invoice
npm install
npm run dev
\`\`\`

## Usage

Open the app, add your client and line items, preview the invoice, then export it as a PDF.

## Roadmap

- Add invoice templates.
- Add recurring invoice reminders.

## License

MIT`;

createElement("#readmeInput").value = completeReadme;
const completeResult = context.analyze();

assert.strictEqual(completeResult.results.length, 12, "all checks should run");
assert.ok(completeResult.score >= 85, "complete README should be launch-ready");
assert.ok(createElement("#rewriteOutput").textContent.includes("# Tiny Invoice"));
assert.ok(createElement("#publishList").innerHTML.includes("README score is 85 or higher"));

createElement("#readmeInput").value = "# App";
const weakResult = context.analyze();

assert.ok(weakResult.score < 50, "weak README should score low");
assert.ok(weakResult.results.some((check) => check.severity === "essential" && !check.passed));
assert.ok(context.buildReport().includes("Recommended fixes"));

console.log("Readme Doctor tests passed");
