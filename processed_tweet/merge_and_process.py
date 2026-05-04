import pandas as pd
import numpy as np
import os
import json
from datetime import datetime
from textblob import TextBlob
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.decomposition import LatentDirichletAllocation
import re

# Load topic definitions to use as a guide for naming
TOPIC_DEFS_PATH = 'processed_tweet/topic_definitions.json'
with open(TOPIC_DEFS_PATH, 'r') as f:
    topic_mapping = json.load(f)

topic_names = list(topic_mapping.keys())

def clean_text(text):
    if not isinstance(text, str):
        return ""
    # Remove URLs
    text = re.sub(r'http\S+', '', text)
    # Remove special characters
    text = re.sub(r'[^a-zA-Z\s]', '', text)
    return text.lower().strip()

import nltk
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')

# Initialize VADER analyzer once
vader_analyzer = SentimentIntensityAnalyzer()

def get_sentiment(text):
    if not isinstance(text, str) or text.strip() == "":
        return 0.0, 0.0, 0.0, 'neutral'
    
    # TextBlob
    blob = TextBlob(text)
    polarity = blob.sentiment.polarity
    subjectivity = blob.sentiment.subjectivity
    
    # VADER
    vs = vader_analyzer.polarity_scores(text)
    compound = vs['compound']
    
    # Direction
    direction = 'neutral'
    if compound >= 0.05:
        direction = 'positive'
    elif compound <= -0.05:
        direction = 'negative'
        
    return compound, polarity, subjectivity, direction

def main():
    print("🚀 Starting Merge and Process Pipeline...")
    
    # 1. Load Datasets
    hist_path = 'fetch_tweet/trump_tweets_dataset.csv'
    new_path = 'fetch_tweet/trump_truth_social_2026.csv'
    
    df_hist = pd.read_csv(hist_path)
    df_new = pd.read_csv(new_path)
    
    print(f"📦 Loaded {len(df_hist)} historical tweets and {len(df_new)} new tweets.")
    
    # 2. Merge and De-duplicate
    df_all = pd.concat([df_hist, df_new], ignore_index=True)
    df_all = df_all.drop_duplicates(subset=['id'])
    
    # Ensure date is datetime
    df_all['date'] = pd.to_datetime(df_all['date'], errors='coerce', utc=True)
    df_all = df_all.dropna(subset=['date'])
    df_all = df_all.sort_values('date', ascending=False)
    
    print(f"🔄 Merged into {len(df_all)} unique tweets.")
    
    # 3. Sentiment Analysis
    print("🧠 Running Sentiment Analysis...")
    sentiments = df_all['text'].apply(get_sentiment)
    df_all['sentiment_score'] = [s[0] for s in sentiments]
    df_all['textblob_polarity'] = [s[1] for s in sentiments]
    df_all['textblob_subjectivity'] = [s[2] for s in sentiments]
    df_all['sentiment_direction'] = [s[3] for s in sentiments]
    
    # Mock VADER standalone columns to match schema
    df_all['vader_positivity'] = df_all['sentiment_score']
    df_all['vader_standalone_score'] = df_all['sentiment_score']
    df_all['vader_standalone_positivity'] = df_all['sentiment_score']
    
    # 4. Topic Modeling
    print("🏷️ Running Topic Modeling (LDA)...")
    texts = df_all['text'].fillna("").apply(clean_text)
    
    # Use CountVectorizer for LDA
    vectorizer = CountVectorizer(max_df=0.95, min_df=2, stop_words='english')
    tf = vectorizer.fit_transform(texts)
    
    # Fit LDA
    lda = LatentDirichletAllocation(n_components=len(topic_names), random_state=42)
    lda.fit(tf)
    
    # Assign topics
    topic_results = lda.transform(tf)
    df_all['dominant_topic_idx'] = topic_results.argmax(axis=1)
    df_all['dominant_topic'] = df_all['dominant_topic_idx'].apply(lambda x: topic_names[x])
    
    # 5. Save Results
    output_path = 'processed_tweet/trump_tweets_topics.csv'
    df_all.to_csv(output_path, index=False)
    
    print(f"✅ Processed dataset saved to {output_path}")
    print(f"📊 Final Tweet Count: {len(df_all)}")

if __name__ == "__main__":
    main()
