# PoliticianTrades — Trump Market Reflex

Interactive dashboard exploring tweet timing, keyword/topic emphasis, and short-horizon equity context (candlesticks with sentiment-style labels and abnormal-return summaries). Built as a static front end served by a small Express app.

## Requirements

- **Node.js** 18+ (for `npm` and `node`)
- **Python 3** (optional — only needed to fetch fresh OHLC CSVs via Yahoo Finance)

## Quick start

From this directory (`politician-vs-stock/`):

```bash
npm install
npm start
```

The server listens on **port 3001**. Open:

**[http://localhost:3001](http://localhost:3001)**

You should see `index.html` (“Trump Market Reflex”) with the candlestick view, word cloud, and related tweet panel.

### npm scripts


| Script        | Command          |
| ------------- | ---------------- |
| `npm start`   | `node server.js` |
| `npm run dev` | Same as `start`  |


## Optional: Python data fetch

To enable `**GET /api/fetch-stock?ticker=SYMBOL`** (used by the UI when adding a ticker) or to run the fetch script manually:

```bash
cd fetch_stock
python3 -m pip install -r requirements.txt
cd ..
python3 fetch_stock/fetch_stock.py NVDA
```

That writes something like `NVDA_last_1mo.csv` in the **project root**. If Python or dependencies are missing, the dashboard still runs using bundled JSON/CSV where applicable.

## API


| Method | Path                           | Description                                                                                         |
| ------ | ------------------------------ | --------------------------------------------------------------------------------------------------- |
| GET    | `/api/fetch-stock?ticker=NVDA` | Runs `fetch_stock/fetch_stock.py` for the given ticker; responds with JSON when the CSV is written. |


Static assets (HTML, JS, CSS, data files) are served from the project root.

## Project layout (high level)


| Path                                                      | Role                                 |
| --------------------------------------------------------- | ------------------------------------ |
| `index.html`, `style.css`                                 | Shell and styling                    |
| `script.js`, `wordCloud.js`                               | Charts, tweets, interactions         |
| `server.js`                                               | Express static server + fetch route  |
| `fetch_stock/`                                            | `fetch_stock.py`, `requirements.txt` |
| `trump_tweets_dataset.csv`, `*.json`, `unprocessed_data/` | Tweet and market inputs              |
| `design.md`, `scope.md`                                   | Design intent and scope notes        |


## Troubleshooting

- **Port in use:** Another process may be bound to `3001`. Stop it or temporarily change `PORT` in `server.js`.
- **Blank charts:** Confirm you opened `http://localhost:3001` (not `file://`). CDNs must load for D3 / chart libraries.
- **Fetch fails:** Check `python3` works and run `pip install -r fetch_stock/requirements.txt`; Yahoo Finance may rate-limit or block some networks.

