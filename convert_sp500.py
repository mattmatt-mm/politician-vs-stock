import csv
from datetime import datetime
import os

def transform_sp500_data(input_file, output_file):
    print(f"Reading {input_file}...")
    
    rows = []
    
    # Read the unprocessed data
    with open(input_file, mode='r', encoding='utf-8-sig') as f:
        # utf-8-sig automatically handles the Byte Order Mark (BOM)
        reader = csv.DictReader(f)
        
        for row in reader:
            # Parse the date: "12/31/2025" -> 2025-12-31
            date_str = row['Date']
            date_obj = datetime.strptime(date_str, '%m/%d/%Y')
            formatted_date = date_obj.strftime('%Y-%m-%d')
            
            # Parse the price: "6,845.50" -> 6845.5
            price_str = row['Price'].replace(',', '')
            
            rows.append({
                'Date': formatted_date,
                'S&P500': price_str
            })
    
    # Sort by date ascending (oldest first)
    rows.sort(key=lambda x: x['Date'])
    
    print(f"Writing {output_file}...")
    
    # Write the transformed data
    with open(output_file, mode='w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['Date', 'S&P500'])
        writer.writeheader()
        writer.writerows(rows)
    
    print("Done!")

if __name__ == "__main__":
    input_path = 'unprocessed_data/S&P 500 Historical Data.csv'
    output_path = 'sp500_index_new.csv' # Using a new name initially for safety
    
    if os.path.exists(input_path):
        transform_sp500_data(input_path, output_path)
    else:
        print(f"Error: Could not find {input_path}")
