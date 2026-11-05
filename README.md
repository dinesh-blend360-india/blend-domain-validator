# Blend Domain Validator

A desktop-first workspace for manually classifying websites from a domain list. It runs entirely in your browser. There is no account, database, remote API, or application backend. The header uses the [Blend mark shown by its rebrand agency](https://www.outliant.com/case-studies/blend360).

## Start on Windows

From this folder in PowerShell, run either static server:

```powershell
node tools/serve.mjs
```

If Python is installed, this also works:

```powershell
py -m http.server 5500
```

Open **http://localhost:5500** in current Chrome or Edge. Keep using the same address and browser profile so Local Storage can restore your session. Opening `index.html` directly through `file://` is unsupported because the app uses JavaScript modules. The included Node script only serves static files for local development; the application itself has no Node backend.

## Review workflow

1. Open **Import domains** in the left sidebar. Paste hostnames or full HTTP/HTTPS URLs separated by lines, commas, semicolons, or Excel tabs. Click **Append domains** or **Replace list**. Replace asks for confirmation if a session already exists.
2. Duplicate detection compares hostnames case-insensitively, including against the existing list when appending. Use **Keep duplicate records** to retain them. The import summary reports accepted, duplicate, and invalid entries. Duplicate records remain separate reviews.
3. Choose a domain from the left list or header menu, or use Previous/Next. The first imported site opens automatically. A visit is recorded when the site is opened or its load is attempted; visiting alone does not mark it reviewed.
4. Select a validation label on the right. **Relevant** needs no comment. **Partial** and every other non-Relevant label need a nonblank comment to count as reviewed. Older sessions and backups using “Partially relevant” load as “Partial” without losing their comments. Changes save automatically to this browser's Local Storage. The save indicator confirms success or reports failure.
5. Search and filter the domain list without changing its original order. The header tracks Total, Visited, Not visited, Relevant, and Reviewed. Relevant counts only the exact Relevant label; Reviewed counts completed classifications.

Click **Results** in the header to preview every Domain, Label, and Comment in import order. The preview has **Copy with header**, **Copy without header**, and **Download CSV** actions. Close it with its Close button, × button, or Escape. Pending records appear with blank label and comment cells.

The blue list item is the current domain. Previously visited domains are green, unvisited ones are grey, and a checkmark indicates a completed review. Both sidebars can collapse or resize independently. The header menu button always opens or closes the domain list; the narrow panel rails also toggle their panels. **Focus view** hides both panels until you exit it. On narrow screens, panels appear as overlays.

## Results and session safety

- **Copy results** puts a tab-separated table on the clipboard with exactly `Domain`, `Label`, and `Comment` columns. Quoted fields preserve tabs and line breaks for Excel. Clipboard access requires localhost or another secure origin.
- **Download CSV** exports all records in their import order, including pending records with blank labels or comments. It uses UTF-8 with a BOM and escapes commas, quotes, and line breaks.
- **Export backup** downloads the full versioned session as JSON, including domain order, visit history, labels, comments, current selection, and panel preferences.
- **Restore backup** validates the JSON and asks before replacing the current session. It does not execute backup content.
- **Clear all data** asks before removing the session's domains and reviews. Export a CSV or backup first if you need the work. Panel preferences are retained.

Local Storage is tied to one origin, browser profile, and device. It is not cloud storage or multi-user sync. Browser data clearing or storage quotas can remove or block a session, so export JSON backups regularly. If stored data becomes unreadable, the app leaves it untouched and offers restore or clear actions.

## Website preview limits

The center iframe loads only the current site. Some sites block embedding with `X-Frame-Options` or Content Security Policy. Browsers do not reliably tell a parent page whether every cross-origin iframe succeeded. **Open in new tab** remains available above the preview, and the validation workspace stays open. The app never bypasses embedding restrictions or proxies site content. A site may also require sign-in or block local browsing.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| Left / Right Arrow | Previous / next domain, outside input fields |
| Ctrl + Enter | Validate and save current review |
| Ctrl + F | Focus the domain search field |

## Project files

```text
index.html                 Application structure and accessible controls
css/styles.css             Fixed viewport styling
css/layout.css             Stable panel placement and narrow-screen layout
assets/blend-mark.webp      Bundled Blend logo mark
js/app.js                  UI state, interactions, and iframe browsing
js/domainManager.js        Input parsing and duplicate detection
js/validation.js           Review rules and statistics
js/storage.js              Versioned Local Storage and backup validation
js/export.js               Clipboard table and file exports
js/results.js              On-screen results table
tools/serve.mjs            Optional local static server
tests/core.test.mjs        Dependency-free core tests
tests/results.test.mjs     Results table tests
```

Run the tests with `node --test tests/core.test.mjs tests/results.test.mjs tests/static.test.mjs`. No package installation is required. `package.json` only enables ES modules and provides development scripts.
