#!/usr/bin/env python3
"""
compute_term_frequency.py

Extracts term frequencies from processed tweets for bar chart visualization.
Uses the same tokenization as build_word_cloud_data.py.

Run after extract_topics.py:
  python3 compute_term_frequency.py

Outputs:
  - data/ml/term_frequency.json (top 20 words with frequencies)
"""

import json
import os
from collections import Counter

import pandas as pd

from tweet_tokenizer import clean_and_tokenize, STOP_WORDS

# Configuration
MIN_FREQUENCY = 5
TOP_N = 20


def compute_term_frequency():
    input_path = "data/ml/trump_tweets_topics.csv"
    output_path = "data/ml/term_frequency.json"

    if not os.path.exists(input_path):
        print(f"Error: {input_path} not found (run add_sentiment.py and extract_topics.py first)")
        return False

    print(f"Loading {input_path}...")
    df = pd.read_csv(input_path, low_memory=False)
    print(f"Loaded {len(df)} tweets")

    word_counts = Counter()
    processed = 0

    for text in df['text'].fillna(''):
        tokens = clean_and_tokenize(text)
        filtered = [w for w in tokens if w not in STOP_WORDS and len(w) > 2]
        word_counts.update(filtered)
        processed += 1
        if processed % 10000 == 0:
            print(f"  Processed {processed} tweets...")

    print(f"Total unique words: {len(word_counts)}")

    filtered_counts = {w: c for w, c in word_counts.items() if c >= MIN_FREQUENCY}
    top_words = dict(sorted(filtered_counts.items(), key=lambda x: -x[1])[:TOP_N])

    print(f"Top {TOP_N} words (min freq {MIN_FREQUENCY}):")
    for i, (word, count) in enumerate(top_words.items(), 1):
        print(f"  {i:2}. {word}: {count}")

    print(f"\nSaving to {output_path}...")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump(top_words, f, indent=2)

    print("Done!")
    return True


if __name__ == "__main__":
    success = compute_term_frequency()
    exit(0 if success else 1)
