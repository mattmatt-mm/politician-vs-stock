#!/usr/bin/env python3
"""
build_topic_stock_signals.py

Adds tweet-level stock signal columns to trump_tweets_topics.csv and generates
aggregate topic-stock signals JSON.

Run after extract_topics.py in the pipeline:
  python3 add_sentiment.py
  python3 extract_topics.py
  python3 build_topic_stock_signals.py

Outputs:
  - Modified data/ml/trump_tweets_topics.csv (adds 3 columns)
  - New data/ml/topic_stock_signals.json (aggregate signals)
"""

import pandas as pd
import json
import os
from collections import defaultdict

# Topic-to-stock mapping (must match server.js TOPIC_STOCK_MAP)
TOPIC_STOCK_MAP = {
    'National Security': ['PLTR', 'LMT', 'BA', 'RTX'],
    'Technology & Crypto': ['TSLA', 'NVDA', 'BTC', 'COIN', 'MSFT'],
    'Economy & Trade': ['SP500', 'DJIA', 'GOLD', 'AAPL', 'AMZN'],
    'Energy & Border': ['TSLA', 'XOM', 'CVX', 'NEE', 'F'],
    'Healthcare & Misc': ['UNH', 'JNJ', 'PFE'],
    'Global Relations': ['BA', 'CAT', 'SP500'],
    'Political Strategy': ['SP500', 'DJIA']
}


def build_signals():
    input_path = "data/ml/trump_tweets_topics.csv"
    output_csv = "data/ml/trump_tweets_topics.csv"
    output_json = "data/ml/topic_stock_signals.json"

    if not os.path.exists(input_path):
        print(f"Error: {input_path} not found. Run extract_topics.py first.")
        return False

    print(f"Loading {input_path}...")
    df = pd.read_csv(input_path, low_memory=False)
    print(f"Loaded {len(df)} tweets with {len(df.columns)} columns")

    # Tweet-level columns
    # dominant_topic_prob: default 1.0 (LDA probabilities not stored in CSV yet)
    df['dominant_topic_prob'] = 1.0

    # mapped_tickers: comma-separated tickers from TOPIC_STOCK_MAP
    def get_mapped_tickers(topic):
        if pd.isna(topic) or topic == '':
            return ''
        return ','.join(TOPIC_STOCK_MAP.get(topic, []))

    df['mapped_tickers'] = df['dominant_topic'].apply(get_mapped_tickers)

    # tweet_stock_signal: sentiment_score * dominant_topic_prob
    # Handle missing sentiment_score gracefully
    df['sentiment_score'] = pd.to_numeric(df['sentiment_score'], errors='coerce').fillna(0)
    df['tweet_stock_signal'] = df['sentiment_score'] * df['dominant_topic_prob']

    print(f"Added columns: dominant_topic_prob, mapped_tickers, tweet_stock_signal")

    # Aggregate signals by topic and ticker
    aggregates = defaultdict(lambda: defaultdict(lambda: {
        'sum_signal': 0.0,
        'count': 0,
        'positive_count': 0,
        'negative_count': 0
    }))

    for _, row in df.iterrows():
        topic = row['dominant_topic']
        if pd.isna(topic) or topic == '':
            continue

        signal = row['tweet_stock_signal']
        tickers = TOPIC_STOCK_MAP.get(topic, [])

        for ticker in tickers:
            agg = aggregates[topic][ticker]
            agg['sum_signal'] += signal
            agg['count'] += 1
            if signal > 0:
                agg['positive_count'] += 1
            elif signal < 0:
                agg['negative_count'] += 1

    # Format output JSON
    output = {}
    for topic in sorted(aggregates.keys()):
        output[topic] = {}
        for ticker in sorted(aggregates[topic].keys()):
            stats = aggregates[topic][ticker]
            count = stats['count']
            output[topic][ticker] = {
                'net_signal': round(stats['sum_signal'], 4),
                'avg_signal': round(stats['sum_signal'] / count, 4) if count > 0 else 0,
                'positive_count': stats['positive_count'],
                'negative_count': stats['negative_count'],
                'tweet_count': count
            }

    # Save outputs
    print(f"Saving {output_csv} ({len(df.columns)} columns)...")
    df.to_csv(output_csv, index=False)

    print(f"Saving {output_json}...")
    with open(output_json, 'w') as f:
        json.dump(output, f, indent=2)

    # Summary
    total_topics = len(output)
    total_tickers = sum(len(tickers) for tickers in output.values())
    print(f"\nDone! Generated signals for {total_topics} topics, {total_tickers} topic-ticker pairs")
    print(f"CSV columns: {list(df.columns)[-3:]}")

    return True


if __name__ == "__main__":
    success = build_signals()
    exit(0 if success else 1)
