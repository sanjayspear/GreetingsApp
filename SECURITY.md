# Security and privacy

## What the app does with your data
- Runs entirely in your browser. There is no server, account or analytics.
- Names, messages, photos and generated cards are never uploaded. Saved dates stay in this browser's `localStorage`.
- Optional AI greetings only run if the site owner sets `VITE_AI_ENDPOINT`; then the form details (not the photo) are sent to that URL.
- The exported "surprise" file is self-contained: it embeds fonts and your photo and blocks all network requests (CSP `default-src 'none'`). Anyone who has the file can see what is inside it, including the photo.
- The "surprise link" packs the names and messages (never the photo) into the URL fragment (`#s=...`). Browsers don't send the fragment to any server, so nothing is uploaded, but anyone who has the link can read the text. The page validates the decoded data and only draws it onto a canvas.

## Hardening in place
- Production Content-Security-Policy (no inline scripts, no third-party origins), `no-referrer`, `rel="noopener noreferrer"` on external links.
- User text reaches the page only via `textContent`, form values or canvas text. No `eval`/`document.write`.
- Dependencies audited in CI (`npm audit --audit-level=high`) and updated weekly by Dependabot. CI uses least-privilege tokens.

## Reporting a vulnerability
Open a private security advisory on the GitHub repository (Security → Report a vulnerability), or contact the maintainer directly. Please do not file public issues for vulnerabilities.
