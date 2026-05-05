import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path
import sys
import os

# Configuration
BASE_DIR = Path(__file__).resolve().parent.parent
FETCH_DIR = BASE_DIR / "fetch_stock"
PROCESSED_DIR = BASE_DIR / "processed_stock"

# Ensure directories exist
FETCH_DIR.mkdir(exist_ok=True)
PROCESSED_DIR.mkdir(exist_ok=True)

def process_and_save(df, ticker):
    """Standardizes the dataframe and saves it to the processed folder."""
    if df.empty:
        return
    
    # Flatten MultiIndex if present
    # Flatten MultiIndex and drop any 'Ticker' level if present
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    
    # Ensure index is a column
    df = df.reset_index()
    
    # Find the column that represents time and rename it to 'Date'
    time_col = None
    for col in df.columns:
        if str(col).lower() in ['date', 'datetime', 'index', 'timestamp']:
            time_col = col
            break
            
    if time_col:
        df = df.rename(columns={time_col: 'Date'})
    
    # Strictly keep ONLY these columns and drop everything else
    # This prevents the "extra commas" issue
    standard_cols = ['Date', 'Open', 'High', 'Low', 'Close', 'Volume']
    
    # Make sure standard columns exist (case insensitive search)
    col_map = {}
    for c in df.columns:
        for s in standard_cols:
            if str(c).lower() == s.lower():
                col_map[c] = s
    
    df = df.rename(columns=col_map)
    df = df[[c for c in standard_cols if c in df.columns]]
    
    # Drop rows where any price is NaN
    df = df.dropna(subset=['Open', 'High', 'Low', 'Close'], how='any')
    
    # Sort and remove duplicates
    df = df.drop_duplicates(subset=['Date'], keep='last').sort_values('Date')
    
    # Save to Raw (fetch_stock)
    raw_path = FETCH_DIR / f"{ticker}_raw.csv"
    df.to_csv(raw_path, index=False)
    
    # Save to Processed (processed_stock)
    processed_path = PROCESSED_DIR / f"{ticker}.csv"
    df.to_csv(processed_path, index=False)
    
    print(f"✅ Data processed and saved to: {processed_path}")
    return f"{ticker}.csv"

def fetch_hybrid_data(ticker):
    """Fetches Daily data from 2019 and Hourly data for the last 730 days."""
    now = datetime.now()
    start_date_daily = "2019-01-01"
    
    # 730 days is the limit for 1h data
    hourly_limit_date = now - timedelta(days=729)
    
    print(f"🚀 Fetching Hybrid data for {ticker}...")
    
    # 1. Fetch Daily Data (Full range)
    print(f"  - Fetching daily data from {start_date_daily}...")
    df_daily = yf.download(ticker, start=start_date_daily, end=now, interval="1d")
    
    # 2. Fetch Hourly Data (Last 730 days)
    print(f"  - Fetching hourly data from {hourly_limit_date.date()}...")
    df_hourly = yf.download(ticker, start=hourly_limit_date, end=now, interval="1h")
    
    if df_daily.empty and df_hourly.empty:
        print(f"❌ No data found for {ticker}")
        return None

    # 3. Combine Data
    # Ensure both are timezone-aware (UTC) to avoid comparison errors
    if df_daily.index.tz is None:
        df_daily.index = df_daily.index.tz_localize('UTC')
    if df_hourly.index.tz is None:
        df_hourly.index = df_hourly.index.tz_localize('UTC')
    
    # We prefer hourly data where available
    df_daily_filtered = df_daily[df_daily.index < df_hourly.index.min()] if not df_hourly.empty else df_daily
    
    df_combined = pd.concat([df_daily_filtered, df_hourly])
    df_combined = df_combined[~df_combined.index.duplicated(keep='last')]
    df_combined.sort_index(inplace=True)
    
    return df_combined

if __name__ == "__main__":
    if len(sys.argv) > 1:
        ticker = sys.argv[1].strip().upper()
    else:
        print("=== Hybrid Stock Fetcher (Daily 2019 + Hourly 2y) ===")
        ticker = input("Enter Ticker (e.g. AAPL): ").strip().upper()
    
    if not ticker:
        print("Ticker is required.")
        sys.exit(1)
        
    df = fetch_hybrid_data(ticker)
    if df is not None:
        filename = process_and_save(df, ticker)
        if filename:
            print(f"SUCCESS_FILENAME:{filename}")
    else:
        print(f"Failed to fetch data for {ticker}")