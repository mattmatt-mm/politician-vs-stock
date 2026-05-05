#!/usr/bin/env python3
"""
build_word_cloud_data.py

Builds keyword search-cloud data from the processed topic CSV (same text column
as the main app). Tokenization matches compute_term_frequency.py.

Run after extract_topics.py:
  python3 build_word_cloud_data.py

Outputs:
  - data/ml/word_cloud_keywords.json
"""

import json
import os
from collections import Counter

import pandas as pd

from tweet_tokenizer import clean_and_tokenize, STOP_WORDS

# Mirrors script.js MARKET_KEYWORDS (order matters for duplicate keyword → ticker)
MARKET_KEYWORDS = {
    "SP500": [
        "spy", "s&p", "market", "markets", "stocks", "economy", "inflation",
        "rates", "tariff", "tariffs", "tax", "taxes", "jobs", "growth", "fed",
    ],
    "SPY": [
        "spy", "s&p", "market", "markets", "stocks", "economy", "inflation",
        "rates", "tariff", "tariffs", "tax", "taxes", "jobs", "growth", "fed",
    ],
    "NVDA": [
        "nvda", "nvidia", "chip", "chips", "semiconductor", "ai",
        "blackwell", "rubin", "tariff", "tariffs",
    ],
    "TSLA": [
        "tsla", "tesla", "musk", "ev", "electric", "autonomous", "fsd",
    ],
}

# server.js getDiscoveredTickers adds these for the stock cloud; used for bare token → ticker
EXTRA_TICKERS = ["PLTR", "AAPL", "MSFT", "BA", "LMT", "BTC", "COIN"]

TOP_N = 100


def _build_keyword_to_ticker():
    m = {}
    for ticker, kws in MARKET_KEYWORDS.items():
        for kw in kws:
            m[kw.lower()] = ticker
    return m


KEYWORD_TO_TICKER = _build_keyword_to_ticker()
DIRECT_TICKERS = list(MARKET_KEYWORDS.keys()) + EXTRA_TICKERS


def classify_token(word: str):
    """
    Return (category, related_stock) matching wordCloud.js / server.js conventions.
    """
    w = word.lower()
    for t in DIRECT_TICKERS:
        if w == t.lower():
            if t == "BTC":
                return "Stock", "SP500"
            return "Stock", t
    if w in KEYWORD_TO_TICKER:
        return "Stock", KEYWORD_TO_TICKER[w]
    return "General", "SPY"


def build_word_cloud_data():
    input_path = "data/ml/trump_tweets_topics.csv"
    output_path = "data/ml/word_cloud_keywords.json"

    if not os.path.exists(input_path):
        print(f"Error: {input_path} not found (run add_sentiment.py and extract_topics.py first)")
        return False

    print(f"Loading {input_path}...")
    df = pd.read_csv(input_path, low_memory=False)
    print(f"Loaded {len(df)} tweets")

    word_counts = Counter()
    processed = 0
    for text in df["text"].fillna(""):
        if pd.isna(text):
            text = ""
        tokens = clean_and_tokenize(text)
        filtered = [x for x in tokens if x not in STOP_WORDS and len(x) > 2]
        word_counts.update(filtered)
        processed += 1
        if processed % 10000 == 0:
            print(f"  Processed {processed} tweets...")

    top_pairs = word_counts.most_common(TOP_N)
    out = []
    for word, count in top_pairs:
        cat, stock = classify_token(word)
        out.append({
            "text": word,
            "size": count,
            "category": cat,
            "related_stock": stock,
        })

    print(f"Writing {len(out)} keyword entries to {output_path}...")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(out, f, indent=2)

    print("Done!")
    return True


if __name__ == "__main__":
    ok = build_word_cloud_data()
    exit(0 if ok else 1)
