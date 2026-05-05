#!/usr/bin/env python3
"""Shared tweet text tokenization for ML helpers (term frequency, word cloud)."""

import re

import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize

try:
    nltk.data.find('corpora/stopwords')
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('stopwords', quiet=True)
    nltk.download('punkt', quiet=True)

CUSTOM_STOPWORDS = frozenset([
    "trump", "donald", "president", "rt", "amp", "https", "co", "http", "www",
    # Align with script.js countWordsInEvents media noise
    "video", "videos", "image", "images", "photo", "photos", "pic", "pics",
    "gif", "gifs", "jpg", "jpeg", "png", "thumbnail", "thumbnails",
    "media", "attachment", "attachments",
    "twitter", "instagram", "facebook",
])


def build_stop_words():
    words = set(stopwords.words('english'))
    words.update(CUSTOM_STOPWORDS)
    return words


STOP_WORDS = build_stop_words()


def clean_and_tokenize(text):
    """Clean text and return list of tokens."""
    if text is None:
        return []

    text = str(text).lower()
    text = re.sub(r'http\S+|www\S+|https\S+', '', text)
    text = re.sub(r'@\w+', '', text)
    text = re.sub(r'#\w+', '', text)
    text = re.sub(r'[^a-z\s]', '', text)

    try:
        tokens = word_tokenize(text)
    except Exception:
        tokens = text.split()

    return tokens


def filter_tokens(tokens):
    """Drop stopwords and very short tokens."""
    return [w for w in tokens if w not in STOP_WORDS and len(w) > 2]
