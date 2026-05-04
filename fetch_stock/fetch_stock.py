import yfinance as yf
import pandas as pd
from datetime import datetime
from pathlib import Path


INTRADAY_INTERVALS = {"1m", "2m", "5m", "15m", "30m", "60m", "1h"}
ALL_INTERVALS = INTRADAY_INTERVALS | {"1d", "5d", "1wk", "1mo", "3mo"}
INTRADAY_LOOKBACK_DAYS = {
    "1m": 8,
    "2m": 60,
    "5m": 60,
    "15m": 60,
    "30m": 60,
    "60m": 730,
    "1h": 730,
}


def _parse_date(date_text):
    return datetime.strptime(date_text, "%Y-%m-%d")


def _validate_intraday_range(start_date, end_date, interval):
    if not (start_date and end_date):
        return True

    try:
        start_dt = _parse_date(start_date)
        end_dt = _parse_date(end_date)
    except ValueError:
        print("日期格式不正确，请使用 YYYY-MM-DD。")
        return False

    if end_dt <= start_dt:
        print("结束日期必须晚于开始日期。")
        return False

    lookback_days = (end_dt - start_dt).days
    max_lookback_days = INTRADAY_LOOKBACK_DAYS.get(interval, 60)
    if lookback_days > max_lookback_days:
        print(f"Yahoo Finance 的 {interval} 分钟级数据通常只能回溯最近 {max_lookback_days} 天。")
        return False

    return True


def _build_filename(ticker, start_date, end_date, period, interval):
    if start_date and end_date:
        return f"{ticker}_{start_date}_to_{end_date}_{interval}.csv"
    return f"{ticker}_last_{period}_{interval}.csv"


def _get_output_path(filename):
    return Path(__file__).resolve().parent / filename


def _get_default_period(interval):
    if interval in INTRADAY_INTERVALS:
        return f"{INTRADAY_LOOKBACK_DAYS[interval] - 1}d"
    return "1mo"

import sys

def fetch_custom_stock():
    # 1. 获取输入参数 (CLI 或交互式)
    if len(sys.argv) > 1:
        ticker = sys.argv[1].strip().upper()
        start_year = sys.argv[2].strip() if len(sys.argv) > 2 else ""
        end_year = sys.argv[3].strip() if len(sys.argv) > 3 else ""
        
        # Convert years to date range
        start_date = f"{start_year}-01-01" if start_year else ""
        end_date = f"{end_year}-12-31" if end_year else ""
        
        # For the automated frontend connection, we always use hourly
        interval = "1h"
        
        print(f"Executing automated fetch for ticker: {ticker}, years: {start_year} to {end_year} (Hourly)")
    else:
        print("=== 股票数据抓取小工具 ===")
        ticker = input("请输入股票代码 (例如 NVDA, AAPL, TSLA): ").strip().upper()
        if not ticker:
            print("股票代码不能为空！")
            return

        print("\n[时间设置] 格式为 YYYY-MM-DD。如果直接按回车跳过，将默认抓取最近一个月的数据。")
        start_date = input("请输入开始日期 (例如 2023-01-01): ").strip()
        end_date = input("请输入结束日期 (例如 2023-12-31): ").strip()

        print("\n[周期设置] 默认是日线。可输入分钟级间隔，例如 1m, 2m, 5m, 15m, 30m, 60m, 1h。")
        interval = input("请输入数据间隔 (直接回车默认 1d): ").strip().lower() or "1d"

    if not ticker:
        return

    if interval not in ALL_INTERVALS:
        print(f"不支持的数据间隔：{interval}。请使用 1m, 2m, 5m, 15m, 30m, 60m, 1h, 1d, 5d, 1wk, 1mo, 3mo。")
        return

    # Check for intraday limits (1h is 730 days)
    if interval in INTRADAY_INTERVALS and start_date and end_date:
        if not _validate_intraday_range(start_date, end_date, interval):
            print(f"警告：{interval} 数据只能回溯最近 {INTRADAY_LOOKBACK_DAYS.get(interval)} 天。")
            # We continue anyway, yfinance will just return what it can

    print(f"\n正在向雅虎财经请求 {ticker} 的数据，请稍候...")
    
    try:
        # 3. 根据用户是否输入了日期，调用不同的抓取参数
        if start_date and end_date:
            df_new = yf.download(ticker, start=start_date, end=end_date, interval=interval)
        else:
            default_period = _get_default_period(interval)
            df_new = yf.download(ticker, period=default_period, interval=interval)

        if df_new.empty:
            print(f"警告：未能抓取到 {ticker} 的数据。")
            return

        # 4. Standardize Filename to [TICKER].csv
        filename = f"{ticker}.csv"
        output_path = _get_output_path(filename)

        # 5. Handle Data Merging if file exists
        if output_path.exists():
            print(f"正在合并新数据到现有文件: {output_path}")
            try:
                # Load existing data, ensuring Date is the index or a column
                df_old = pd.read_csv(output_path, index_col=0, parse_dates=True)
                
                # Combine and drop duplicates
                df_combined = pd.concat([df_old, df_new])
                # Remove duplicates based on index (the timestamp)
                df_combined = df_combined[~df_combined.index.duplicated(keep='last')]
                # Sort by index
                df_combined.sort_index(inplace=True)
                df_final = df_combined
            except Exception as e:
                print(f"合并数据时出错: {e}，将覆盖原始文件。")
                df_final = df_new
        else:
            df_final = df_new

        # 6. Save as CSV
        # Flatten MultiIndex columns if present (common with yfinance)
        if isinstance(df_final.columns, pd.MultiIndex):
            df_final.columns = df_final.columns.get_level_values(0)
        
        # Ensure index is named 'Date' for consistency
        if df_final.index.name != 'Date':
            df_final.index.name = 'Date'
            
        df_final.to_csv(output_path)
        print(f"成功！数据已保存到: {output_path}")
        print(f"SUCCESS_FILENAME:{filename}")

    except Exception as e:
        print(f"抓取过程中发生错误: {e}")

if __name__ == "__main__":
    fetch_custom_stock()