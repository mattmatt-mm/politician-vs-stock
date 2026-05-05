import pandas as pd
import numpy as np
from textblob import TextBlob
import re
import os
from datetime import datetime

# Configuration
INPUT_CSV = "fetch_tweet/TwExport_realDonaldTrump_Posts.csv"
OUTPUT_CSV = "processed_tweet/trump_tweets_topics.csv"

# Topic Categories and Keywords (to match your LDA model output)
TOPIC_KEYWORDS = {
    "Economy & Trade": ["tariff", "economy", "trade", "jobs", "growth", "prosperity", "stock", "market", "401k", "income"],
    "National Security": ["military", "war", "security", "defense", "peace", "strength", "isis", "terrorist", "strike"],
    "Media & Truth": ["news", "media", "fake", "truth", "hoax", "witch", "hunt", "reporting", "lies"],
    "Energy & Border": ["border", "migrant", "oil", "energy", "venezuela", "illegal", "fence", "wall", "patrol"],
    "Technology & Crypto": ["crypto", "bitcoin", "tech", "ai", "amazon", "google", "digital", "internet"],
    "Global Relations": ["china", "russia", "putin", "nato", "thailand", "cambodia", "world", "alliance"],
    "Political Strategy": ["democrat", "radical", "left", "biden", "harris", "election", "vote", "maga", "republican"],
    "Healthcare & Misc": ["health", "vaccine", "medicine", "doctor", "cognitive", "insurance", "child", "care"]
}

def classify_topic(text):
    text = str(text).lower()
    scores = {topic: 0 for topic in TOPIC_KEYWORDS}
    for topic, keywords in TOPIC_KEYWORDS.items():
        for word in keywords:
            if word in text:
                scores[topic] += 1
    
    # Return the topic with the highest score, default to Healthcare & Misc if no match
    max_score = max(scores.values())
    if max_score == 0:
        return 7, "Healthcare & Misc"
    
    top_topic = max(scores, key=scores.get)
    topic_list = list(TOPIC_KEYWORDS.keys())
    return topic_list.index(top_topic), top_topic

def get_sentiment(text):
    blob = TextBlob(str(text))
    polarity = blob.sentiment.polarity # -1 to 1
    subjectivity = blob.sentiment.subjectivity
    
    # Map to dashboard's "sentiment_score" (roughly VADER style)
    # We'll use polarity as a proxy
    return polarity, "positive" if polarity > 0.05 else ("negative" if polarity < -0.05 else "neutral"), subjectivity

def transform():
    if not os.path.exists(INPUT_CSV):
        print(f"Error: {INPUT_CSV} not found")
        return

    print(f"Reading {INPUT_CSV}...")
    df_raw = pd.read_csv(INPUT_CSV)

    print("Transforming columns...")
    processed_data = []

    for _, row in df_raw.iterrows():
        text = str(row['Text'])
        polarity, direction, subjectivity = get_sentiment(text)
        topic_idx, topic_name = classify_topic(text)
        
        # Parse date
        dt_str = row['Created At']
        try:
            # TwExport usually uses YYYY-MM-DD HH:MM:SS
            dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S")
            iso_date = dt.strftime("%Y-%m-%dT%H:%M:%S-05:00") # Assuming EST
        except:
            iso_date = dt_str

        entry = {
            "id": row['ID'],
            "date": iso_date,
            "platform": "Twitter",
            "handle": row['Author Username'],
            "text": text,
            "favorite_count": row['Favorite Count'],
            "repost_count": row['Retweet Count'],
            "quote_flag": str(row['Type']).lower() == "quoted",
            "repost_flag": str(row['Type']).lower() == "retweet",
            "deleted_flag": False,
            "word_count": len(text.split()),
            "hashtags": row['hashtags'] if pd.notna(row['hashtags']) else "",
            "urls": row['urls'] if pd.notna(row['urls']) else "",
            "user_mentions": "", # Extraction could be added here
            "media_count": 1 if pd.notna(row['media_urls']) else 0,
            "media_urls": row['media_urls'] if pd.notna(row['media_urls']) else "",
            "post_url": row['Tweet URL'],
            "in_reply_to": "",
            "sentiment_score": round(polarity, 4),
            "vader_positivity": round(max(0, polarity), 4),
            "vader_standalone_score": round(polarity, 4),
            "vader_standalone_positivity": round(max(0, polarity), 4),
            "sentiment_direction": direction,
            "textblob_polarity": round(polarity, 4),
            "textblob_subjectivity": round(subjectivity, 4),
            "dominant_topic_idx": topic_idx,
            "dominant_topic": topic_name
        }
        processed_data.append(entry)

    df_out = pd.DataFrame(processed_data)
    
    # Save to processed folder
    print(f"Saving {len(df_out)} tweets to {OUTPUT_CSV}...")
    df_out.to_csv(OUTPUT_CSV, index=False)
    print("Done!")

if __name__ == "__main__":
    transform()
