import yfinance as yf
import pandas as pd
import sys
import os

def fetch_custom_stock():
    # 1. Get ticker, start_date, end_date from CLI args if available, otherwise interactive
    if len(sys.argv) > 1:
        ticker = sys.argv[1].strip().upper()
        start_date = sys.argv[2].strip() if len(sys.argv) > 2 else ""
        end_date = sys.argv[3].strip() if len(sys.argv) > 3 else ""
        print(f"Executing automated fetch for ticker: {ticker}")
    else:
        print("=== 股票数据抓取小工具 ===")
        ticker = input("请输入股票代码 (例如 NVDA, AAPL, TSLA): ").strip().upper()
        if not ticker:
            print("股票代码不能为空！")
            return
        print("\n[时间设置] 格式为 YYYY-MM-DD。如果直接按回车跳过，将默认抓取最近一个月的数据。")
        start_date = input("请输入开始日期 (例如 2023-01-01): ").strip()
        end_date = input("请输入结束日期 (例如 2023-12-31): ").strip()

    if not ticker:
        return

    print(f"\n正在向雅虎财经请求 {ticker} 的数据，请稍候...")
    
    try:
        # 3. Download data based on provided range or default 1mo
        if start_date and end_date:
            df = yf.download(ticker, start=start_date, end=end_date)
            filename = f"{ticker}_{start_date}_to_{end_date}.csv"
        else:
            df = yf.download(ticker, period="1mo")
            filename = f"{ticker}_last_1mo.csv"

        if df.empty:
            print(f"警告：未能抓取到 {ticker} 的数据。请检查股票代码是否正确，或该时间段是否有交易。")
            sys.exit(1)

        # Handle yfinance multi-index columns (recent yfinance versions)
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)

        # 5. Save to CSV
        # If called from server.js (which sets cwd to project root), saving to filename will save to root.
        # However, to be absolutely robust, we can save it to the directory above this script's directory.
        script_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(script_dir)
        filepath = os.path.join(project_root, filename)

        df.to_csv(filepath)
        print(f"成功！数据已成功保存到: {filepath}")

    except Exception as e:
        print(f"抓取过程中发生错误: {e}")
        sys.exit(1)

if __name__ == "__main__":
    fetch_custom_stock()