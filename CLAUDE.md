# Chess Coach

Chrome extension (Manifest V3) for chess.com: reads the board, runs Stockfish
19 lite WASM locally and explains the best move with built-in rules. See
README.md for layout and controls. Published **unlisted** on the Chrome Web
Store (https://chromewebstore.google.com/detail/gkgdhdndflaloikghohonplbnmaippee)
and linked from the huian.us homepage; its privacy section lives in the
huian.us repo at `privacy/index.html`. If the extension ever starts sending
data anywhere, update that section in the same change.

## Learning mode is a hard rule

The coach must stay off during games against people (`src/board.js` page
allowlist). Engine help in live or daily games breaks chess.com's fair-play
rules. Don't loosen this.

## Languages

All user-facing text is in `src/i18n.js` (English + Simplified Chinese); the
panel and toolbar popup share the `coachSettings.lang` setting in
`chrome.storage.local`. Any new string needs both languages. The extension
name/description for the store come from `static/_locales/*/messages.json`.
English output is asserted by `test/explain.test.mjs`, so keep wording
changes and tests in sync.

## Build / verify

- `npm test`: board tests and explanation tests against the real engine.
- `npm run build`: writes the unpacked extension to `extension/` (gitignored).
- Store package: zip the *contents* of `extension/` to
  `store/chess-coach-X.Y.Z.zip` (gitignored).

## Versioning & releases

Same policy as the other huian.us projects. **Semver bump every release:**
fixes bump **patch**, new features bump **minor** (reset patch), large or
breaking changes consider **major**. Bump **before** building.
`static/manifest.json` `version` and `package.json` `version` move
**together** (the Chrome Web Store rejects an upload whose version isn't
higher). Then commit, tag `vX.Y.Z`, push with the tag, and
`gh release create vX.Y.Z` on `githuian/chess-coach` with curated notes
grouped by feature area, attaching the store zip.
