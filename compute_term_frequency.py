#!/usr/bin/env python3
"""
compute_term_frequency.py

Extracts term frequencies from raw tweets for bar chart visualization.
Excludes stopwords and outputs top N words.

Run independently (does not depend on sentiment/topic pipeline):
  python3 compute_term_frequency.py

Outputs:
  - data/ml/term_frequency.json (top 20 words with frequencies)
"""

import pandas as pd
import json
import re
import os
from collections import Counter

import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize

# Ensure NLTK data is available
try:
    nltk.data.find('corpora/stopwords')
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('stopwords', quiet=True)
    nltk.download('punkt', quiet=True)

# Configuration
CUSTOM_STOPWORDS = ["trump", "donald", "president", "rt", "amp", "https", "co", "http", "www"]
MIN_FREQUENCY = 5
TOP_N = 20


def clean_and_tokenize(text):
    """Clean text and return list of tokens."""
    if pd.isna(text):
        return []

    text = str(text).lower()

    # Remove URLs
    text = re.sub(r'http\S+|www\S+|https\S+', '', text)

    # Remove @mentions
    text = re.sub(r'@\w+', '', text)

    # Remove #hashtags
    text = re.sub(r'#\w+', '', text)

    # Remove non-alphabetic characters
    text = re.sub(r'[^a-z\s]', '', text)

    # Tokenize
    try:
        tokens = word_tokenize(text)
    except Exception:
        tokens = text.split()

    return tokens


def compute_term_frequency():
    input_path = "data/raw/trump_tweets_dataset.csv"
    output_path = "data/ml/term_frequency.json"

    if not os.path.exists(input_path):
        print(f"Error: {input_path} not found")
        return False

    print(f"Loading {input_path}...")
    df = pd.read_csv(input_path, low_memory=False)
    print(f"Loaded {len(df)} tweets")

    # Build combined stopword set
    stop_words = set(stopwords.words('english'))
    stop_words.update(CUSTOM_STOPWORDS)

    # Count all words
    word_counts = Counter()
    processed = 0

    for text in df['text'].fillna(''):
        tokens = clean_and_tokenize(text)
        # Filter: not stopword, length > 2
        filtered = [w for w in tokens if w not in stop_words and len(w) > 2]
        word_counts.update(filtered)
        processed += 1
        if processed % 10000 == 0:
            print(f"  Processed {processed} tweets...")

    print(f"Total unique words: {len(word_counts)}")

    # Filter by minimum frequency and take top N
    filtered_counts = {w: c for w, c in word_counts.items() if c >= MIN_FREQUENCY}
    top_words = dict(sorted(filtered_counts.items(), key=lambda x: -x[1])[:TOP_N])

    print(f"Top {TOP_N} words (min freq {MIN_FREQUENCY}):")
    for i, (word, count) in enumerate(top_words.items(), 1):
        print(f"  {i:2}. {word}: {count}")

    # Save output
    print(f"\nSaving to {output_path}...")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump(top_words, f, indent=2)

    print("Done!")
    return True


if __name__ == "__main__":
    success = compute_term_frequency()
    exit(0 if success else 1)
