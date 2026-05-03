import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.decomposition import LatentDirichletAllocation
import json
import os
import re
import nltk
from nltk.corpus import stopwords

# Ensure stopwords are downloaded
try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords')

def clean_text(text):
    # Remove URLs, mentions, and special characters
    text = str(text).lower()
    text = re.sub(r'http\S+|www\S+|https\S+', '', text, flags=re.MULTILINE)
    text = re.sub(r'@\w+', '', text)
    text = re.sub(r'#\w+', '', text)
    text = re.sub(r'[^a-z\s]', '', text)
    return text.strip()

def extract_topics():
    input_path = "data/ml/trump_tweets_scored.csv"
    output_csv = "data/ml/trump_tweets_topics.csv"
    output_json = "data/ml/topic_definitions.json"

    if not os.path.exists(input_path):
        print(f"Error: {input_path} not found.")
        return

    print(f"Loading {input_path}...")
    df = pd.read_csv(input_path)
    
    print("Preprocessing text...")
    stop_words = list(stopwords.words('english'))
    # Add common twitter/politics words to stop words
    stop_words.extend(['rt', 'amp', 'u', 'get', 'would', 'could', 'one', 'going'])
    
    cleaned_texts = df['text'].fillna('').apply(clean_text)
    
    print("Building term-document matrix...")
    vectorizer = CountVectorizer(max_df=0.9, min_df=5, stop_words=stop_words)
    dtm = vectorizer.fit_transform(cleaned_texts)
    
    print("Training LDA model (8 topics)...")
    lda = LatentDirichletAllocation(n_components=8, random_state=42, max_iter=10)
    lda.fit(dtm)
    
    # Extract topics and keywords
    words = vectorizer.get_feature_names_out()
    topics_meta = {}
    colors = ['#E11D48', '#D97706', '#059669', '#2563EB', '#7C3AED', '#4B5563', '#10B981', '#F43F5E']
    
    topic_names = [
        "Economy & Trade", "National Security", "Media & Truth", 
        "Energy & Border", "Technology & Crypto", "Global Relations",
        "Political Strategy", "Healthcare & Misc"
    ]

    for i, topic in enumerate(lda.components_):
        top_indices = topic.argsort()[-10:][::-1]
        keywords = [words[idx] for idx in top_indices]
        
        name = topic_names[i]
        topics_meta[name] = {
            "keywords": keywords,
            "color": colors[i % len(colors)]
        }
        print(f"Topic {i} ({name}): {', '.join(keywords)}")

    print("Assigning topics to tweets...")
    topic_results = lda.transform(dtm)
    df['dominant_topic_idx'] = topic_results.argmax(axis=1)
    df['dominant_topic'] = df['dominant_topic_idx'].apply(lambda x: topic_names[x])
    
    print(f"Saving enriched dataset to {output_csv}...")
    df.to_csv(output_csv, index=False)
    
    print(f"Saving topic definitions to {output_json}...")
    with open(output_json, 'w') as f:
        json.dump(topics_meta, f, indent=4)

    print("Topic modeling complete!")

if __name__ == "__main__":
    extract_topics()
