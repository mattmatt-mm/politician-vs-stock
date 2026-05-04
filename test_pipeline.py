#!/usr/bin/env python3
"""
test_pipeline.py

Tests for build_topic_stock_signals.py and compute_term_frequency.py outputs.

Run with: pytest test_pipeline.py -v
"""

import pytest
import pandas as pd
import json
import os


class TestBuildTopicStockSignals:
    """Tests for build_topic_stock_signals.py output"""

    @pytest.fixture
    def csv_path(self):
        return "data/ml/trump_tweets_topics.csv"

    @pytest.fixture
    def json_path(self):
        return "data/ml/topic_stock_signals.json"

    @pytest.fixture
    def df(self, csv_path):
        if not os.path.exists(csv_path):
            pytest.skip(f"{csv_path} not found. Run build_topic_stock_signals.py first.")
        return pd.read_csv(csv_path, nrows=1000, low_memory=False)

    @pytest.fixture
    def signals_json(self, json_path):
        if not os.path.exists(json_path):
            pytest.skip(f"{json_path} not found. Run build_topic_stock_signals.py first.")
        with open(json_path) as f:
            return json.load(f)

    def test_csv_has_new_columns(self, df):
        """Verify new columns are present in CSV"""
        required_cols = ['dominant_topic_prob', 'mapped_tickers', 'tweet_stock_signal']
        for col in required_cols:
            assert col in df.columns, f"Missing column: {col}"

    @pytest.mark.parametrize("col,expected_type", [
        ("dominant_topic_prob", "float"),
        ("tweet_stock_signal", "float"),
    ])
    def test_column_types(self, df, col, expected_type):
        """Verify column types are correct"""
        if expected_type == "float":
            # Check it's numeric
            assert pd.api.types.is_numeric_dtype(df[col]), f"{col} should be numeric"

    def test_signal_range(self, df):
        """Signal should be bounded by sentiment_score range [-1, 1]"""
        valid = df['tweet_stock_signal'].dropna()
        assert (valid >= -1).all(), "tweet_stock_signal has values < -1"
        assert (valid <= 1).all(), "tweet_stock_signal has values > 1"

    def test_dominant_topic_prob_default(self, df):
        """dominant_topic_prob should be 1.0 (default)"""
        valid = df['dominant_topic_prob'].dropna()
        assert (valid == 1.0).all(), "dominant_topic_prob should be 1.0 for all rows"

    def test_mapped_tickers_format(self, df):
        """mapped_tickers should be comma-separated strings or empty"""
        for val in df['mapped_tickers'].dropna().head(100):
            if val:
                # Should be comma-separated uppercase tickers
                tickers = val.split(',')
                for ticker in tickers:
                    assert ticker == ticker.upper(), f"Ticker {ticker} should be uppercase"
                    assert ticker.isalnum() or ticker.isalpha(), f"Invalid ticker format: {ticker}"

    def test_json_structure(self, signals_json):
        """Verify JSON has correct nested structure"""
        assert isinstance(signals_json, dict), "Root should be dict"

        for topic, tickers in signals_json.items():
            assert isinstance(topic, str), f"Topic key should be string: {topic}"
            assert isinstance(tickers, dict), f"Tickers for {topic} should be dict"

            for ticker, stats in tickers.items():
                required_keys = ['net_signal', 'avg_signal', 'positive_count',
                                'negative_count', 'tweet_count']
                for key in required_keys:
                    assert key in stats, f"Missing key {key} in {topic}/{ticker}"

    def test_json_counts_non_negative(self, signals_json):
        """All counts should be non-negative integers"""
        for topic, tickers in signals_json.items():
            for ticker, stats in tickers.items():
                assert stats['positive_count'] >= 0, f"Negative positive_count in {topic}/{ticker}"
                assert stats['negative_count'] >= 0, f"Negative negative_count in {topic}/{ticker}"
                assert stats['tweet_count'] >= 0, f"Negative tweet_count in {topic}/{ticker}"
                # positive + negative <= total (neutral tweets exist)
                assert stats['positive_count'] + stats['negative_count'] <= stats['tweet_count'], \
                    f"pos+neg exceeds total in {topic}/{ticker}"


class TestComputeTermFrequency:
    """Tests for compute_term_frequency.py output"""

    @pytest.fixture
    def json_path(self):
        return "data/ml/term_frequency.json"

    @pytest.fixture
    def term_freq(self, json_path):
        if not os.path.exists(json_path):
            pytest.skip(f"{json_path} not found. Run compute_term_frequency.py first.")
        with open(json_path) as f:
            return json.load(f)

    def test_json_exists(self, json_path):
        """Output JSON should exist"""
        assert os.path.exists(json_path), f"{json_path} does not exist"

    def test_json_structure(self, term_freq):
        """JSON should be word:count pairs"""
        assert isinstance(term_freq, dict), "Should be a dictionary"
        for word, count in term_freq.items():
            assert isinstance(word, str), f"Word should be string: {word}"
            assert isinstance(count, int), f"Count should be int: {count}"

    def test_max_20_entries(self, term_freq):
        """Should have at most TOP_N (20) entries"""
        assert len(term_freq) <= 20, f"Has {len(term_freq)} entries, expected <= 20"

    def test_min_frequency_threshold(self, term_freq):
        """All words should have frequency >= MIN_FREQUENCY (5)"""
        for word, count in term_freq.items():
            assert count >= 5, f"Word '{word}' has count {count} < 5"

    @pytest.mark.parametrize("stopword", [
        "trump", "donald", "president", "rt", "amp", "https", "co"
    ])
    def test_stopwords_excluded(self, term_freq, stopword):
        """Custom stopwords should not appear in output"""
        assert stopword not in term_freq, f"Stopword '{stopword}' should be excluded"

    def test_sorted_by_frequency(self, term_freq):
        """Words should be sorted by frequency (descending)"""
        counts = list(term_freq.values())
        assert counts == sorted(counts, reverse=True), "Words not sorted by frequency"

    def test_words_are_lowercase(self, term_freq):
        """All words should be lowercase"""
        for word in term_freq.keys():
            assert word == word.lower(), f"Word '{word}' should be lowercase"


class TestEdgeCases:
    """Edge case tests"""

    @pytest.fixture
    def json_path(self):
        return "data/ml/topic_stock_signals.json"

    @pytest.fixture
    def signals_json(self, json_path):
        if not os.path.exists(json_path):
            pytest.skip(f"{json_path} not found")
        with open(json_path) as f:
            return json.load(f)

    def test_neutral_sentiment_counted(self, signals_json):
        """Neutral tweets (signal=0) should be in tweet_count but not pos/neg"""
        for topic, tickers in signals_json.items():
            for ticker, stats in tickers.items():
                pos_neg = stats['positive_count'] + stats['negative_count']
                assert pos_neg <= stats['tweet_count'], \
                    f"pos+neg ({pos_neg}) > total ({stats['tweet_count']}) in {topic}/{ticker}"

    def test_avg_signal_consistency(self, signals_json):
        """avg_signal should equal net_signal / tweet_count"""
        for topic, tickers in signals_json.items():
            for ticker, stats in tickers.items():
                if stats['tweet_count'] > 0:
                    expected_avg = stats['net_signal'] / stats['tweet_count']
                    # Allow small floating point tolerance
                    assert abs(stats['avg_signal'] - expected_avg) < 0.001, \
                        f"avg_signal mismatch in {topic}/{ticker}"


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
