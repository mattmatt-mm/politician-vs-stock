import yfinance as yf
import pandas as pd
from datetime import datetime
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

def process_and_merge(df_new, ticker):
    """Standardizes the new data and merges it with existing records."""
    if df_new.empty:
        return None
    
    # 1. Flatten and Reset New Data
    if isinstance(df_new.columns, pd.MultiIndex):
        df_new.columns = df_new.columns.get_level_values(0)
    
    df_new = df_new.reset_index()
    
    # 2. Standardize Time Column to 'Date'
    time_col = None
    for col in df_new.columns:
        if col.lower() in ['date', 'datetime', 'index', 'timestamp']:
            time_col = col
            break
            
    if time_col:
        df_new = df_new.rename(columns={time_col: 'Date'})
    
    # Standard columns only
    standard_cols = ['Date', 'Open', 'High', 'Low', 'Close', 'Volume']
    available_cols = [col for col in standard_cols if col in df_new.columns]
    df_new = df_new[available_cols]
    
    # 3. Load Existing Data for Merging
    processed_path = PROCESSED_DIR / f"{ticker}.csv"
    if processed_path.exists():
        print(f"📂 Found existing file for {ticker}, merging...")
        try:
            df_old = pd.read_csv(processed_path)
            df_final = pd.concat([df_old, df_new])
        except Exception as e:
            print(f"⚠️ Error reading existing file: {e}. Overwriting instead.")
            df_final = df_new
    else:
        df_final = df_new
    
    # 4. Deduplicate and Sort
    # Convert to datetime for correct sorting, then back to string
    df_final['Date'] = pd.to_datetime(df_final['Date'], utc=True)
    df_final = df_final.drop_duplicates(subset=['Date'], keep='last').sort_values('Date')
    
    # Format Date back to string for clean CSV
    df_final['Date'] = df_final['Date'].dt.strftime('%Y-%m-%d %H:%M:%S%z')
    
    # 5. Save Output
    df_final.to_csv(processed_path, index=False)
    
    # Save a raw copy for backup
    raw_path = FETCH_DIR / f"{ticker}_raw.csv"
    df_new.to_csv(raw_path, index=False)
    
    print(f"✅ Successfully processed and merged into: {processed_path}")
    return f"{ticker}.csv"

def fetch_yearly_data(ticker, year):
    """Fetches Hourly data for a specific year."""
    start_date = f"{year}-01-01"
    end_date = f"{year}-12-31"
    
    # If it's the current year, use today as end date
    current_year = datetime.now().year
    if int(year) == current_year:
        end_date = datetime.now().strftime("%Y-%m-%d")
    
    print(f"🚀 Fetching Hourly data for {ticker} in {year} ({start_date} to {end_date})...")
    
    df = yf.download(ticker, start=start_date, end=end_date, interval="1h")
    
    if df.empty:
        print(f"❌ No data found for {ticker} in {year}. (Note: Hourly data is limited to last 730 days)")
        return None
    
    return df

if __name__ == "__main__":
    if len(sys.argv) > 2:
        ticker = sys.argv[1].strip().upper()
        year = sys.argv[2].strip()
    else:
        print("=== Yearly Stock Importer (Hourly) ===")
        ticker = input("Enter Ticker (e.g. AAPL): ").strip().upper()
        year = input("Enter Year (e.g. 2025): ").strip()
    
    if not ticker or not year:
        print("Ticker and Year are required.")
        sys.exit(1)
        
    df_new = fetch_yearly_data(ticker, year)
    if df_new is not None:
        filename = process_and_merge(df_new, ticker)
        if filename:
            print(f"SUCCESS_FILENAME:{filename}")
    else:
        print(f"Failed to fetch data.")