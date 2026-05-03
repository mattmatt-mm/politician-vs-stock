import pandas as pd
import nltk
from nltk.sentiment.vader import SentimentIntensityAnalyzer
import os

# Ensure vader_lexicon is downloaded
try:
    nltk.data.find('sentiment/vader_lexicon.zip')
except LookupError:
    nltk.download('vader_lexicon')

def process_sentiment(input_file, output_file):
    print(f"Reading dataset: {input_file}")
    df = pd.read_csv(input_file, low_memory=False)
    
    print("Initializing VADER Sentiment Analyzer...")
    sia = SentimentIntensityAnalyzer()
    
    # Custom lexicon updates to match the context
    custom_lexicon = {
        'inflation': -2.0,
        'tariffs': -1.0,
        'tariff': -1.0,
        'sanctions': -2.0,
        'trade war': -2.0,
        'crash': -3.0,
        'disaster': -3.0,
        'devastating': -3.0,
        'all time high': 3.0,
        'record high': 3.0,
        'great news': 3.0,
        'growth': 2.0,
        'tax cuts': 2.0,
        'boom': 2.0,
        'victory': 2.0,
    }
    sia.lexicon.update(custom_lexicon)
    
    print("Computing sentiment scores...")
    # Compute compound score for each tweet's text
    # Handle missing text by filling with empty string
    texts = df['text'].fillna('').astype(str)
    
    scores = []
    directions = []
    
    for text in texts:
        score = sia.polarity_scores(text)['compound']
        scores.append(score)
        
        if score >= 0.05:
            directions.append('positive')
        elif score <= -0.05:
            directions.append('negative')
        else:
            directions.append('neutral')
            
    df['sentiment_score'] = scores
    df['sentiment_direction'] = directions
    
    print(f"Saving scored dataset to: {output_file}")
    df.to_csv(output_file, index=False)
    print("Done!")

if __name__ == "__main__":
    input_path = "trump_tweets_dataset.csv"
    output_path = "trump_tweets_scored.csv"
    
    if os.path.exists(input_path):
        process_sentiment(input_path, output_path)
    else:
        print(f"Error: Could not find {input_path}")
