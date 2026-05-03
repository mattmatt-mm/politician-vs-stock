import pandas as pd
import nltk
from nltk.sentiment.vader import SentimentIntensityAnalyzer
import os
from textblob import TextBlob
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer as StandaloneSIA

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
    standalone_sia = StandaloneSIA()
    
    # Custom lexicon updates for NLTK VADER
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
    # Also update standalone if possible (vaderSentiment uses a different lexicon structure but we can try update)
    standalone_sia.lexicon.update(custom_lexicon)
    
    print("Computing sentiment scores...")
    texts = df['text'].fillna('').astype(str)
    
    vader_compounds = []
    vader_positivity = []
    vader_standalone_compounds = []
    vader_standalone_positivity = []
    directions = []
    tb_polarities = []
    tb_subjectivities = []
    
    for text in texts:
        # NLTK VADER
        v_scores = sia.polarity_scores(text)
        compound = v_scores['compound']
        vader_compounds.append(compound)
        vader_positivity.append(v_scores['pos'])
        
        # Standalone VADER
        vs_scores = standalone_sia.polarity_scores(text)
        vader_standalone_compounds.append(vs_scores['compound'])
        vader_standalone_positivity.append(vs_scores['pos'])
        
        if compound >= 0.05:
            directions.append('positive')
        elif compound <= -0.05:
            directions.append('negative')
        else:
            directions.append('neutral')
            
        # TextBlob
        blob = TextBlob(text)
        tb_polarities.append(blob.sentiment.polarity)
        tb_subjectivities.append(blob.sentiment.subjectivity)
            
    df['sentiment_score'] = vader_compounds
    df['vader_positivity'] = vader_positivity
    df['vader_standalone_score'] = vader_standalone_compounds
    df['vader_standalone_positivity'] = vader_standalone_positivity
    df['sentiment_direction'] = directions
    df['textblob_polarity'] = tb_polarities
    df['textblob_subjectivity'] = tb_subjectivities
    
    print(f"Saving scored dataset to: {output_file}")
    df.to_csv(output_file, index=False)
    print("Done!")

if __name__ == "__main__":
    input_path = "data/raw/trump_tweets_dataset.csv"
    output_path = "data/ml/trump_tweets_scored.csv"
    
    if os.path.exists(input_path):
        process_sentiment(input_path, output_path)
    else:
        print(f"Error: Could not find {input_path}")
