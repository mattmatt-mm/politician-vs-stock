import pandas as pd
import json
import re
from collections import Counter
import nltk
from nltk.corpus import stopwords

def clean_word(word):
    return re.sub(r'[^a-z0-9]', '', word.lower())

def generate_word_cloud():
    print("☁️ Generating Word Cloud Data...")
    
    # 1. Load merged dataset
    df = pd.read_csv('processed_tweet/trump_tweets_topics.csv')
    df['date'] = pd.to_datetime(df['date'])
    
    # 2. Extract words
    try:
        stop_words = set(stopwords.words('english'))
    except:
        nltk.download('stopwords')
        stop_words = set(stopwords.words('english'))
        
    custom_stop = {'https', 'co', 'rt', 'realdonaldtrump', 'amp', 'u', 'w', 'the', 'to', 'a', 'in', 'of', 'and', 'on', 'is', 'for'}
    stop_words.update(custom_stop)
    
    all_words = []
    word_to_events = {}
    
    # Simple keyword to stock mapping logic (can be expanded)
    keyword_stocks = {
        'tesla': 'TSLA',
        'nvidia': 'NVDA',
        'apple': 'AAPL',
        'google': 'GOOGL',
        'amazon': 'AMZN',
        'microsoft': 'MSFT',
        'deere': 'DE',
        'boeing': 'BA',
        'tariffs': 'SPY',
        'economy': 'SPY',
        'market': 'SPY',
        'china': 'SPY',
        'mexico': 'SPY',
        'canada': 'SPY'
    }
    
    # Categorization logic
    def get_category(word):
        if word in keyword_stocks:
            return "Stock"
        return "General"

    print("📊 Counting frequencies...")
    for idx, row in df.iterrows():
        text = str(row['text'])
        words = [clean_word(w) for w in text.split() if len(clean_word(w)) > 3]
        words = [w for w in words if w not in stop_words]
        
        for w in set(words): # Use set to count only once per tweet
            all_words.append(w)
            if w not in word_to_events:
                word_to_events[w] = []
            
            # Only keep the most recent 10 events per word to save space
            if len(word_to_events[w]) < 10:
                word_to_events[w].append({
                    "date": row['date'].isoformat(),
                    "text": row['text'],
                    "sentiment": row['sentiment_direction']
                })

    word_counts = Counter(all_words)
    top_words = word_counts.most_common(200)
    
    # 3. Format JSON
    result = []
    for word, count in top_words:
        if "http" in word:
            continue
        related_stock = keyword_stocks.get(word, "SPY")
        result.append({
            "text": word,
            "size": count,
            "category": get_category(word),
            "related_stock": related_stock,
            "events": word_to_events[word]
        })
        
    # 4. Save
    with open('word_cloud_data.json', 'w') as f:
        json.dump(result, f, indent=2)
    
    print(f"✅ Word cloud data generated with {len(result)} words.")

if __name__ == "__main__":
    generate_word_cloud()
