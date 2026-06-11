# Readme Doctor

Readme Doctor is a static browser app that reviews a GitHub README before you publish a project. Paste or import a README, get a launch score, see missing sections, copy a report, and download a stronger README outline.

## Demo

Open `index.html` in a browser. The app runs fully on the client and does not require a server, account, or API key.

## Features

- Scores README launch readiness from 0 to 100.
- Checks title, summary, demo, features, setup steps, usage, tech stack, roadmap, license, length, structure, and command formatting.
- Imports README files from a public GitHub repository URL.
- Opens local Markdown files from your computer.
- Saves your draft in the browser while you work.
- Copies a plain-language improvement report.
- Generates, copies, and downloads a cleaner README outline.
- Includes a publishing checklist for GitHub release readiness.

## Tech Stack

- HTML
- CSS
- JavaScript

## Getting Started

Clone the project:

```bash
git clone https://github.com/your-name/readme-doctor.git
cd readme-doctor
```

Open `index.html` in your browser.

## Usage

1. Paste a README, import a public GitHub repository, or open a local Markdown file.
2. Review the score, metrics, and section-by-section checks.
3. Copy the report if you want a short fix list.
4. Open the Rewrite tab to copy or download a stronger README outline.
5. Open the Publish tab to confirm the project is ready for GitHub Pages.

## Testing

Run the included checks:

```bash
npm test
```

## Deploying to GitHub Pages

1. Push this folder to a GitHub repository.
2. Open the repository settings.
3. Enable GitHub Pages from the default branch.
4. Use `index.html` as the published entry page.

## Roadmap

- Add drag-and-drop Markdown import.
- Add optional custom checklist profiles.
- Add a screenshot preview area for project images.

## Contributing

Pull requests are welcome. Please keep the app static, fast, and easy to understand.

## License

MIT
