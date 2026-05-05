# CHANGELOG

## [Completed] Search Cloud: Processed Tweet Source, Dynamic Keywords & Mode Fixes

### Goal
1. Drive all tweet-derived search-cloud preprocessing from **`data/ml/trump_tweets_topics.csv`** (not raw CSV) for Python artifacts, and align tokenization across scripts.
2. Make the **keyword** word cloud use the **same tweet events** and **visible Highcharts range** as the term-frequency bar (year, ticker, pan/zoom).
3. Fix blank panels when switching cloud modes after **Term Frequency** (Highcharts teardown).
4. Strip **media / URL noise** (e.g. `image`, `images`, `video`, `videos`) consistently in browser counts and Python tokenization.

### Changes

| Date | File | Change | Status |
|------|------|--------|--------|
| 2026-05-05 | `tweet_tokenizer.py` | New — NLTK cleaning + shared `STOP_WORDS` / `filter_tokens()` for Python word stats | ✅ Done |
| 2026-05-05 | `tweet_tokenizer.py` | `CUSTOM_STOPWORDS` extended with media tokens (aligned with `script.js`) | ✅ Done |
| 2026-05-05 | `compute_term_frequency.py` | Input → `data/ml/trump_tweets_topics.csv`; imports `tweet_tokenizer` (run after `extract_topics.py`) | ✅ Done |
| 2026-05-05 | `build_word_cloud_data.py` | New — optional `data/ml/word_cloud_keywords.json` from processed CSV (not used by live keyword mode) | ✅ Done |
| 2026-05-05 | `script.js` | `countWordsInEvents` / `computeTermFrequency` / `computeKeywordCloudData`; `classifyKeywordForCloud` + `KEYWORD_CLOUD_EXTRA_TICKERS` | ✅ Done |
| 2026-05-05 | `script.js` | `update()` + both `afterSetExtremes` handlers: `window.updateKeywordCloud(computeKeywordCloudData(...))` | ✅ Done |
| 2026-05-05 | `script.js` | Expanded stopwords in `countWordsInEvents` for media plurals & attachments | ✅ Done |
| 2026-05-05 | `wordCloud.js` | Keywords from `updateKeywordCloud` only (no static `word_cloud_keywords.json` fetch); loading / empty messages | ✅ Done |
| 2026-05-05 | `wordCloud.js` | `destroyCloudHighcharts()` + clear container when leaving Term Frequency; stable D3 scales when min=max | ✅ Done |
| 2026-05-05 | `wordCloud.js` | `window.updateWordCloud()` — re-render Topics mode after topic definitions load | ✅ Done |
| 2026-05-05 | `CLAUDE.md` | Pipeline order (`build_word_cloud_data.py`); word-cloud behavior & keyword vs static artifact note | ✅ Done |

---

## [Completed] Dynamic Term Frequency (Range-Responsive)

### Goal
Make the term frequency bar chart responsive to the visible chart time range — as users zoom/pan, the word frequencies update to reflect only tweets in the visible window.

### Changes

| Date | File | Change | Status |
|------|------|--------|--------|
| 2026-05-05 | `script.js` | Added `computeTermFrequency(events)` method with stopword filtering | ✅ Done |
| 2026-05-05 | `script.js` | `update()`: call `window.updateTermFrequency()` on initial load | ✅ Done |
| 2026-05-05 | `script.js` | Both `afterSetExtremes` handlers: call `window.updateTermFrequency()` with filtered events | ✅ Done |
| 2026-05-05 | `wordCloud.js` | Added `window.updateTermFrequency(freqData)` to accept dynamic data and re-render bar chart | ✅ Done |

---

## [Completed] Topic Stock Signals & Term Frequency Features

### Goal
Implement two features from `TextAffectonStocksSpec.md`:
1. Rule-based topic-stock signals (CSV columns + aggregate JSON)
2. Term frequency extraction for bar chart visualization

### Changes

| Date | File | Change | Status |
|------|------|--------|--------|
| 2026-05-04 | `build_topic_stock_signals.py` | Created — adds `dominant_topic_prob`, `mapped_tickers`, `tweet_stock_signal` columns; generates `topic_stock_signals.json` | ✅ Done |
| 2026-05-04 | `data/ml/trump_tweets_topics.csv` | Regenerated — now has 31 columns (added 3 new signal columns) | ✅ Done |
| 2026-05-04 | `data/ml/topic_stock_signals.json` | Generated — 7 topics, 27 topic-ticker pairs with aggregate signals | ✅ Done |
| 2026-05-04 | `compute_term_frequency.py` | Created — extracts top 20 words excluding stopwords | ✅ Done |
| 2026-05-04 | `data/ml/term_frequency.json` | Generated — 20 words with frequencies | ✅ Done |
| 2026-05-04 | `server.js` | Added `/api/topic-stock-signals` and `/api/term-frequency` routes | ✅ Done |
| 2026-05-04 | `index.html` | Added "Term Frequency" option to cloud-mode-selector | ✅ Done |
| 2026-05-04 | `wordCloud.js` | Added `termFreqData`, fetch `/api/term-frequency`, `renderBarChart()` with Highcharts horizontal bar | ✅ Done |
| 2026-05-04 | `script.js` | `loadTweets()`: added `mappedTickers`, `tweetStockSignal`, `dominantTopicProb`; `populateTweetStream()`: added Topic Signal and Mapped Tickers metrics | ✅ Done |
| 2026-05-04 | `test_pipeline.py` | Created — pytest tests for CSV columns, JSON structure, edge cases | ✅ Done |

---

## [Completed] Sentiment Analysis Enhancement

### Goal
Add text preprocessing (strip URLs/@mentions/#hashtags) and a new `combined_sentiment` column (0.7×VADER + 0.3×TextBlob) to the sentiment pipeline; expose the score in the tweet sidebar and flag tooltips.

### Changes

| Date | File | Change | Status |
|------|------|--------|--------|
| 2026-05-04 | `CHANGELOG.md` | Created | ✅ Done |
| 2026-05-04 | `add_sentiment.py` | Added `import re`, `preprocess_text()`, preprocessing applied to all text before scoring, added `combined_sentiment` column (0.7×VADER + 0.3×TextBlob) | ✅ Done |
| 2026-05-04 | `data/ml/trump_tweets_scored.csv` | Regenerated — now has 26 columns including `combined_sentiment` | ✅ Done |
| 2026-05-04 | `data/ml/trump_tweets_topics.csv` | Regenerated — `combined_sentiment` flows through (column 26) | ✅ Done |
| 2026-05-04 | `script.js` | `loadTweets()`: map `combinedScore`; `populateTweetStream()`: add "Combined" metric row; `highchartsFlagSeries()`: append combined score to flag tooltip | ✅ Done |
