# Chess Coach

A Chrome extension that reads the board on chess.com and shows a coach panel with:

- **The best move**, plus a green arrow on the board
- **Why** it's best, in plain English: forks, free pieces, rescuing a hanging piece, mate threats, development, open files and similar ideas
- **Watch out**: what your opponent is threatening (red dashed arrow), and any of your pieces left hanging
- The main line, the evaluation and the next-best alternatives

Everything runs locally. The engine is Stockfish 19 (the lite WASM build), and the explanations come from built-in rules. No account or API key is needed.

## Learning mode

The coach turns itself off during games against people (live and daily), since engine help there breaks chess.com's fair-play rules. It works on:
Analysis, Game Review, Puzzles, Lessons, Practice, Drills, Openings/Explorer and games against the computer. After a live game, open **Game Review** or **Analysis** to go over it with the coach.

## Install

```sh
npm install
npm run build
```

1. Open `chrome://extensions` and turn on **Developer mode** (top right).
2. Click **Load unpacked** and pick the `extension` folder.
3. Open https://www.chess.com/analysis. The panel appears at the top right; drag it by its title bar.

After changing code, run `npm run build` and click the reload icon on the extension card.

## Panel controls

- **Side to move**: the coach works out whose turn it is from the last-move highlight. If it guesses wrong, for example on a freshly set-up position, pick White or Black. The choice resets on the next move.
- **Depth**: Fast, Normal or Deep. Deeper is stronger but slower.
- **Language**: Auto, English or 中文. Auto follows the browser's language. All coaching text lives in `src/i18n.js`.
- **Show arrows**: turns the board arrows on or off.

## Development

- `src/board.js`: chess.com DOM classes → FEN, plus the learning-mode page allowlist
- `src/engine.js`: UCI wrapper for the Stockfish web worker
- `src/explain.js`: rule-based explanations from the engine's lines
- `src/content.js`: runs on chess.com; reads the board, hosts the panel, draws arrows
- `src/panel.js`: the coach panel, running in an extension iframe so it can load the engine

`npm test` runs the board tests and explanation tests that use the real engine.

## License

Chess Coach is free software under the GNU General Public License v3.0 or later. See [LICENSE](LICENSE).

It bundles Stockfish, which is also GPLv3; its license ships with the extension as `engine/LICENSE-stockfish.txt`.
