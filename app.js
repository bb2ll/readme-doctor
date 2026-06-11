const storageKey = "readme-doctor-draft";

const input = document.querySelector("#readmeInput");
const repoInput = document.querySelector("#repoInput");
const fileInput = document.querySelector("#fileInput");
const importRepoButton = document.querySelector("#importRepoButton");
const analyzeButton = document.querySelector("#analyzeButton");
const clearButton = document.querySelector("#clearButton");
const sampleButton = document.querySelector("#sampleButton");
const copyButton = document.querySelector("#copyButton");
const copyReportButton = document.querySelector("#copyReportButton");
const downloadButton = document.querySelector("#downloadButton");
const scoreValue = document.querySelector("#scoreValue");
const scoreMood = document.querySelector("#scoreMood");
const scoreBar = document.querySelector("#scoreBar");
const metrics = document.querySelector("#metrics");
const sectionList = document.querySelector("#sectionList");
const publishList = document.querySelector("#publishList");
const reportOutput = document.querySelector("#reportOutput");
const rewriteOutput = document.querySelector("#rewriteOutput");
const statusMessage = document.querySelector("#statusMessage");
const tabs = document.querySelectorAll(".tab");
const tabPanels = {
  checks: document.querySelector("#checksTab"),
  rewrite: document.querySelector("#rewriteTab"),
  publish: document.querySelector("#publishTab"),
};

const sampleReadme = `# Tiny Invoice

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

const checks = [
  {
    id: "title",
    title: "Clear project title",
    points: 8,
    severity: "essential",
    test: (text) => /^#\s+.{3,}$/m.test(text),
    tip: "Start with one clear H1 title so visitors know the project name immediately.",
  },
  {
    id: "summary",
    title: "Plain-language summary",
    points: 12,
    severity: "essential",
    test: (text) => getIntro(text).split(/\s+/).filter(Boolean).length >= 20,
    tip: "Add two or three sentences explaining who this helps and what problem it solves.",
  },
  {
    id: "demo",
    title: "Demo or screenshot",
    points: 10,
    severity: "important",
    test: (text) => /!\[[^\]]*]\([^)]+\)|https?:\/\/\S+|\.gif\)|\.png\)|\.jpg\)/i.test(text),
    tip: "Add a screenshot, GIF, or live demo link so people can judge the project quickly.",
  },
  {
    id: "features",
    title: "Feature list",
    points: 10,
    severity: "essential",
    test: (text) => hasHeading(text, ["features", "what it does"]) && bulletCount(text) >= 3,
    tip: "List the main things users can do. Three to six bullets is enough for a small project.",
  },
  {
    id: "install",
    title: "Setup steps",
    points: 12,
    severity: "essential",
    test: (text) => hasHeading(text, ["install", "setup", "getting started"]) && hasCommand(text),
    tip: "Show the exact commands needed to install and run the project.",
  },
  {
    id: "usage",
    title: "Usage example",
    points: 10,
    severity: "important",
    test: (text) => hasHeading(text, ["usage", "example", "how to use"]) || codeBlockCount(text) > 0,
    tip: "Add the simplest real workflow or command example so users know what happens next.",
  },
  {
    id: "stack",
    title: "Tech stack",
    points: 7,
    severity: "helpful",
    test: (text) => hasHeading(text, ["tech stack", "built with", "stack"]),
    tip: "Mention the main tools or frameworks so contributors know what they are looking at.",
  },
  {
    id: "roadmap",
    title: "Roadmap or contribution notes",
    points: 7,
    severity: "helpful",
    test: (text) => hasHeading(text, ["contributing", "roadmap", "todo", "next"]),
    tip: "Add a short roadmap or contribution note to invite help without overcomplicating it.",
  },
  {
    id: "license",
    title: "License",
    points: 8,
    severity: "essential",
    test: (text) => hasHeading(text, ["license"]) || /\b(MIT|Apache|GPL|BSD|ISC)\b/i.test(text),
    tip: "Include a license so people know whether they can reuse the project.",
  },
  {
    id: "polish",
    title: "Readable length",
    points: 6,
    severity: "helpful",
    test: (text) => {
      const words = wordCount(text);
      return words >= 100 && words <= 1400;
    },
    tip: "Aim for enough detail to be useful without turning the README into a manual.",
  },
  {
    id: "structure",
    title: "Scannable structure",
    points: 6,
    severity: "important",
    test: (text) => headingCount(text) >= 5 && bulletCount(text) >= 3,
    tip: "Use short headings and bullets so visitors can scan the project in under a minute.",
  },
  {
    id: "commands",
    title: "Command formatting",
    points: 4,
    severity: "helpful",
    test: (text) => !hasCommand(text) || /```[\s\S]*\b(npm|pnpm|yarn|pip|uv|cargo|go|docker|git)\b[\s\S]*```/i.test(text),
    tip: "Wrap setup commands in a code block so they are easy to copy.",
  },
];

function hasHeading(text, names) {
  const headings = [...text.matchAll(/^#{1,4}\s+(.+)$/gim)].map((match) =>
    match[1].trim().toLowerCase(),
  );
  return names.some((name) => headings.some((heading) => heading.includes(name)));
}

function hasCommand(text) {
  return /\b(npm|pnpm|yarn|pip|uv|cargo|go|docker|git)\s+\S+/i.test(text);
}

function bulletCount(text) {
  return (text.match(/^\s*[-*]\s+/gm) || []).length;
}

function codeBlockCount(text) {
  return (text.match(/```/g) || []).length / 2;
}

function headingCount(text) {
  return (text.match(/^#{1,4}\s+.+$/gm) || []).length;
}

function wordCount(text) {
  return text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}

function getIntro(text) {
  return text
    .replace(/^#\s+.+/m, "")
    .split(/^##\s+/m)[0]
    .trim();
}

function projectName(text) {
  const match = text.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "Project Name";
}

function analyze({ save = true } = {}) {
  const text = input.value.trim();
  const results = checks.map((check) => ({ ...check, passed: text ? check.test(text) : false }));
  const score = results.reduce((total, check) => total + (check.passed ? check.points : 0), 0);

  renderScore(score, text);
  renderMetrics(text, results);
  renderChecks(results);
  renderRewrite(text, results);
  renderPublishList(text, results, score);
  renderReport(results, score);

  if (save) {
    localStorage.setItem(storageKey, input.value);
  }

  return { text, results, score };
}

function renderScore(score, text) {
  scoreValue.textContent = text ? score : "0";
  scoreBar.style.width = `${text ? score : 0}%`;

  if (!text) {
    scoreMood.textContent = "Paste a README to begin";
  } else if (score >= 85) {
    scoreMood.textContent = "Ready to publish";
  } else if (score >= 70) {
    scoreMood.textContent = "Almost ready";
  } else if (score >= 50) {
    scoreMood.textContent = "Useful draft";
  } else {
    scoreMood.textContent = "Needs the basics";
  }
}

function renderMetrics(text, results) {
  const passed = results.filter((check) => check.passed).length;
  const essentialMissing = results.filter(
    (check) => check.severity === "essential" && !check.passed,
  ).length;

  metrics.innerHTML = [
    metricTemplate(wordCount(text), "words"),
    metricTemplate(headingCount(text), "headings"),
    metricTemplate(`${passed}/${results.length}`, "checks passed"),
    metricTemplate(essentialMissing, "essentials missing"),
  ].join("");
}

function metricTemplate(value, label) {
  return `<div class="metric"><strong>${value}</strong><span>${label}</span></div>`;
}

function renderChecks(results) {
  sectionList.innerHTML = results
    .map((check) => {
      const badgeClass = check.passed ? "good" : check.severity === "essential" ? "bad" : "warn";
      const badgeText = check.passed ? "Pass" : check.severity === "essential" ? "Fix first" : "Improve";
      return `
        <article class="check">
          <div class="check-header">
            <span class="check-title">${check.title}</span>
            <span class="badge ${badgeClass}">${badgeText}</span>
          </div>
          <p>${check.passed ? "Looks good." : check.tip}</p>
        </article>
      `;
    })
    .join("");
}

function renderRewrite(text, results) {
  const name = projectName(text);
  const missing = results.filter((check) => !check.passed).map((check) => check.title);
  const missingText = missing.length ? missing.map((item) => `- ${item}`).join("\n") : "- None";
  const slug = slugify(name);

  rewriteOutput.textContent = `# ${name}

Describe what this project does, who it helps, and the main problem it solves in two or three plain sentences.

## Demo

Add a screenshot, GIF, or live demo link here.

## Features

- Main feature one
- Main feature two
- Main feature three

## Tech Stack

- Add the main language, framework, or tools here

## Getting Started

\`\`\`bash
git clone https://github.com/your-name/${slug}.git
cd ${slug}
npm install
npm run dev
\`\`\`

## Usage

Explain the simplest useful workflow in three to five steps.

## Roadmap

- Add one small improvement
- Add one nice-to-have feature
- Improve documentation

## README gaps found

${missingText}

## License

MIT`;
}

function renderPublishList(text, results, score) {
  const releaseItems = [
    {
      title: "README score is 85 or higher",
      passed: score >= 85,
      detail: "A strong README usually has a demo, setup steps, usage, license, and a clear summary.",
    },
    {
      title: "No essential README gaps",
      passed: !results.some((check) => check.severity === "essential" && !check.passed),
      detail: "Essential gaps make visitors leave before trying the project.",
    },
    {
      title: "Project has a LICENSE file",
      passed: true,
      detail: "This repository includes an MIT license file.",
    },
    {
      title: "Project runs without a backend",
      passed: true,
      detail: "This app is static and can be published with GitHub Pages.",
    },
    {
      title: "README has enough detail",
      passed: wordCount(text) >= 100,
      detail: "A very short README can look unfinished even when the code works.",
    },
  ];

  publishList.innerHTML = releaseItems
    .map(
      (item) => `
        <article class="publish-item ${item.passed ? "ready" : ""}">
          <span aria-hidden="true">${item.passed ? "✓" : "!"}</span>
          <div>
            <strong>${item.title}</strong>
            <p>${item.detail}</p>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderReport(results, score) {
  const failed = results.filter((check) => !check.passed);
  const lines = [
    `Readme Doctor score: ${score}/100`,
    "",
    failed.length ? "Recommended fixes:" : "No README gaps found.",
    ...failed.map((check) => `- ${check.title}: ${check.tip}`),
  ];

  reportOutput.value = lines.join("\n");
}

function buildReport() {
  analyze();
  return reportOutput.value;
}

function slugify(value) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "project-name"
  );
}

function setStatus(message, type = "neutral") {
  statusMessage.textContent = message;
  statusMessage.dataset.type = type;
}

function setActiveTab(tabName) {
  tabs.forEach((tab) => {
    const active = tab.dataset.tab === tabName;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });

  Object.entries(tabPanels).forEach(([name, panel]) => {
    panel.classList.toggle("hidden", name !== tabName);
  });
}

async function importFromRepo() {
  const repoUrl = repoInput.value.trim();
  const match = repoUrl.match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/i);

  if (!match) {
    setStatus("Enter a public GitHub repository URL.", "error");
    return;
  }

  const owner = match[1];
  const repo = match[2].replace(/\.git$/i, "");
  const branches = ["main", "master"];
  setStatus("Importing README from GitHub...", "neutral");

  for (const branch of branches) {
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/README.md`;
    try {
      const response = await fetch(rawUrl);
      if (response.ok) {
        input.value = await response.text();
        analyze();
        setActiveTab("checks");
        setStatus(`Imported README from ${owner}/${repo}.`, "success");
        return;
      }
    } catch (error) {
      setStatus("Could not reach GitHub. Try pasting the README instead.", "error");
      return;
    }
  }

  setStatus("No README.md found on main or master.", "error");
}

function importFromFile(file) {
  if (!file) return;
  const reader = new FileReader();

  reader.addEventListener("load", () => {
    input.value = String(reader.result || "");
    analyze();
    setActiveTab("checks");
    setStatus(`Loaded ${file.name}.`, "success");
  });

  reader.addEventListener("error", () => {
    setStatus("Could not read that file.", "error");
  });

  reader.readAsText(file);
}

async function copyText(text, button, label = "Copied") {
  let copied = false;

  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      copied = true;
    }
  } catch (error) {
    copied = false;
  }

  if (!copied) {
    copied = fallbackCopy(text);
  }

  if (copied) {
    const oldLabel = button.textContent;
    button.textContent = label;
    setTimeout(() => {
      button.textContent = oldLabel;
    }, 1300);
    setStatus("Copied to clipboard.", "success");
  } else {
    selectFallbackText(text);
    setStatus("Copy is blocked here, so the text is selected for you.", "neutral");
  }
}

function fallbackCopy(text) {
  const scratch = document.createElement("textarea");
  scratch.value = text;
  scratch.setAttribute("readonly", "");
  scratch.style.position = "fixed";
  scratch.style.top = "-1000px";
  scratch.style.left = "-1000px";
  document.body.appendChild(scratch);
  scratch.select();

  try {
    return document.execCommand("copy");
  } catch (error) {
    return false;
  } finally {
    scratch.remove();
  }
}

function selectFallbackText(text) {
  if (reportOutput.value === text) {
    setActiveTab("publish");
    reportOutput.focus();
    reportOutput.select();
    return;
  }

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(rewriteOutput);
  selection.removeAllRanges();
  selection.addRange(range);
}

function downloadRewrite() {
  const name = `${slugify(projectName(input.value)) || "readme"}-README.md`;
  const blob = new Blob([rewriteOutput.textContent], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
  setStatus(`Downloaded ${name}.`, "success");
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => setActiveTab(tab.dataset.tab));
});

analyzeButton.addEventListener("click", () => {
  analyze();
  setStatus("README analyzed.", "success");
});

input.addEventListener("input", () => analyze());

clearButton.addEventListener("click", () => {
  input.value = "";
  localStorage.removeItem(storageKey);
  analyze({ save: false });
  setStatus("Draft cleared.", "neutral");
});

sampleButton.addEventListener("click", () => {
  input.value = sampleReadme;
  analyze();
  setStatus("Loaded a complete sample README.", "success");
});

importRepoButton.addEventListener("click", importFromRepo);
repoInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    importFromRepo();
  }
});

fileInput.addEventListener("change", () => importFromFile(fileInput.files[0]));
copyButton.addEventListener("click", () => copyText(rewriteOutput.textContent, copyButton));
copyReportButton.addEventListener("click", () => copyText(buildReport(), copyReportButton));
downloadButton.addEventListener("click", downloadRewrite);

input.value = localStorage.getItem(storageKey) || "";
analyze({ save: false });
