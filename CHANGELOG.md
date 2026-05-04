# CHANGELOG

## [In Progress] Sentiment Analysis Enhancement

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
