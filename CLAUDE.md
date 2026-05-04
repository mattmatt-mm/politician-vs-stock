# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install and run
npm install
npm start          # Serves on http://localhost:3001

# Python data pipeline (run from project root, in order)
pip3 install -r fetch_stock/requirements.txt
python3 add_sentiment.py                    # VADER + TextBlob scoring → data/ml/trump_tweets_scored.csv
python3 extract_topics.py                   # LDA topic modeling → data/ml/trump_tweets_topics.csv + topic_definitions.json
python3 build_topic_stock_signals.py        # Topic-stock signals → modifies trump_tweets_topics.csv + topic_stock_signals.json
python3 compute_term_frequency.py           # Term frequency → data/ml/term_frequency.json
python3 fetch_stock/fetch_stock.py NVDA     # Fetch Yahoo Finance stock data → {TICKER}_last_1mo.csv
python3 convert_sp500.py                    # Transform S&P 500 CSV

# Run tests
.venv/bin/python -m pytest test_pipeline.py -v
```

No linter or formatter configured. Tests use pytest (see `test_pipeline.py`).

## Architecture

This is a static SPA served by an Express.js backend. The frontend loads preprocessed CSV/JSON data files and renders financial visualizations.

**Data flow:**
1. Raw tweets (`data/raw/trump_tweets_dataset.csv`) → Python pipeline → `data/ml/trump_tweets_topics.csv` (the primary data file the frontend consumes)
2. Stock OHLCV data is fetched on demand via `/api/fetch-stock?ticker=X`, which shells out to `fetch_stock/fetch_stock.py` and caches the result as `{TICKER}.csv` in the `fetch_stock/` directory
3. The frontend matches tweet timestamps to ±30-minute OHLCV windows to compute abnormal returns

**Frontend (`script.js` ~1700 LOC):** A single `ReflexChart` class manages all state. Key methods:
- `loadTweets()` – reads the processed CSV; caches topic definitions in `window.TOPIC_DEFINITIONS`
- `loadStockData(ticker)` – tries multiple file locations: root CSVs, `local_data/`, `fetch_stock/`
- `prepareTweetEvents()` – joins tweets to OHLCV windows; filters to tweets within stock data range
- `calculatePostMove()` – core market impact logic (see below)
- `renderActiveChart()` – dispatches to Highcharts Stock or SciChart.js (dual-engine; Highcharts is primary)
- `populateTweetStream()` – renders tweet sidebar

**Word cloud (`wordCloud.js`):** D3 layout with three modes — keyword frequencies (from `word_cloud_data.json`, pre-computed), ticker mentions (from `/api/stock-mentions`), and LDA topics (from `window.TOPIC_DEFINITIONS`).

**Backend (`server.js`):** Express serves static files from project root plus six API routes:

| Route | Purpose |
|-------|---------|
| `GET /api/fetch-stock?ticker=X&startYear=Y&endYear=Z` | Shells out to Python, returns CSV filename |
| `GET /api/list-stocks` | Scans for CSV files in root, `local_data/`, `fetch_stock/` |
| `GET /api/stock-mentions` | Counts ticker mentions in tweet CSV → word cloud data |
| `GET /api/topic-stock-signals` | Returns aggregated sentiment signals by topic/ticker |
| `GET /api/term-frequency` | Returns top 20 word frequencies for bar chart |
| Static `/*` | Serves all HTML/JS/CSS/CSV/JSON directly from root |

## Key Design Decisions

- **Dual chart engine:** Highcharts Stock handles standard rendering; SciChart.js is a WebGL alternative. When switching engines, the visible axis range is preserved to avoid zoom jumps. SciChart uses epoch/1000 seconds; Highcharts uses milliseconds.
- **Python as subprocess:** Stock fetching is not a Node.js service — `server.js` spawns `.venv/bin/python` (falling back to `python3`) and parses the `SUCCESS_FILENAME:{filename}` line from stdout.
- **No bundler:** All JS is loaded via CDN (D3 v7, d3-cloud, Highcharts, SciChart, Lucide). The app must be served over HTTP (not `file://`) for CDN resources to load.
- **Sentiment pipeline is additive:** `add_sentiment.py` writes 5 new sentiment columns; `extract_topics.py` further appends topic columns. Each script reads the previous output.

## Market Impact Calculation (`calculatePostMove`)

This is the most complex logic in the codebase:

1. **Detect interval** — median gap between first 25 candles
2. **Set horizon** — if interval ≤ 2 min → 15-min window; else → 3× interval
3. **Return** — `(close[t+horizon] - close[t]) / close[t] × 100%`
4. **Z-score** — `return / stdev(last 20 returns)`; returns null if volatility < 0.01% (avoids division by near-zero)
5. **Abnormal return** — `stock_return - S&P500_return` only computed when benchmark interval ≤ 2× stock interval
6. **Impact band** — uses Z-score when available: `strong-negative` (≤−2), `negative` (−2 to −0.5), `neutral`, `positive` (0.5–2), `strong-positive` (≥2); falls back to raw return thresholds

## Non-Obvious Details & Gotchas

- **DST handling:** All market timestamps assume NYC time. `isNewYorkDst()` calculates DST boundaries (2nd Sunday of March, 1st Sunday of November) and applies `-04:00` (EDT) or `-05:00` (EST). All data assumed to represent 4pm NY market close.
- **Ticker normalization:** `SPY` maps to `SP500` internally (hardcoded).
- **MARKET_KEYWORDS** in `script.js`: per-ticker keyword filters (e.g., NVDA → `['nvda','nvidia','chip','ai','tariff']`) are hardcoded — update when adding new tickers.
- **TOPIC_STOCK_MAP** in `server.js`: maps LDA topic names to tickers for the semantic mention scoring in `/api/stock-mentions` — hardcoded alongside the 10% scoring weight.
- **yfinance intraday limits:** `fetch_stock.py` forces 1h interval. yfinance allows max 730 days for hourly data. If the file already exists, new data is merged and deduplicated.
- **LDA config:** 8 topics with only 10 max iterations — intentionally fast but potentially underfitted. Topic names and colors are fixed in `extract_topics.py` and regenerated in `topic_definitions.json`.
- **`word_cloud_data.json`:** Pre-computed 100-keyword list at the project root — not regenerated by the Python pipeline. Edit manually if needed.
- **`stock_data_mock.json`:** 68KB fallback OHLC dataset used for demos when real data is unavailable.
- **Line breaks for market gaps:** `withLineBreaks()` inserts NaN points when time gaps exceed 3 days, preventing lines from spanning weekends/holidays.
- **Year filtering double-applies:** Tweets are filtered in `loadTweets()` and again in `prepareTweetEvents()` — both must match the selected year.
- **`scope.md`:** Documents original ambitious vision (Heat Ripple timeline, Toxicity Meter, thread clustering) — several features are described but not implemented.

## Design System

Fintech minimalist (Bloomberg-inspired): off-white `#F2F2F2` base, 1px rigid borders, 4px dot intersections, emerald `#10B981` for gains, rose `#E11D48` for losses. Typography: Instrument Sans (headings), Instrument Serif Italic (emphasis), Inter (data). Defined in `design.md`.
