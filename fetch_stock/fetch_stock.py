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

def fetch_custom_stock():
    print("=== 股票数据抓取小工具 ===")
    
    # 1. 获取用户输入的股票代码，并自动转换为大写，去除首尾空格
    ticker = input("请输入股票代码 (例如 NVDA, AAPL, TSLA): ").strip().upper()
    if not ticker:
        print("股票代码不能为空！")
        return

    # 2. 获取用户输入的时间段
    print("\n[时间设置] 格式为 YYYY-MM-DD。如果直接按回车跳过，将默认抓取最近一个月的数据。")
    start_date = input("请输入开始日期 (例如 2023-01-01): ").strip()
    end_date = input("请输入结束日期 (例如 2023-12-31): ").strip()

    print("\n[周期设置] 默认是日线。可输入分钟级间隔，例如 1m, 2m, 5m, 15m, 30m, 60m, 1h。")
    print("            默认抓取会比真实上限少 1 天，避免卡边界报错。")
    interval = input("请输入数据间隔 (直接回车默认 1d): ").strip().lower() or "1d"

    if interval not in ALL_INTERVALS:
        print(f"不支持的数据间隔：{interval}。请使用 1m, 2m, 5m, 15m, 30m, 60m, 1h, 1d, 5d, 1wk, 1mo, 3mo。")
        return

    if interval in INTRADAY_INTERVALS:
        print(f"当前选择的是 {interval}，如果填写了开始和结束日期，时间跨度通常不要超过 {INTRADAY_LOOKBACK_DAYS[interval]} 天。")

    print(f"\n正在向雅虎财经请求 {ticker} 的数据，请稍候...")
    
    try:
        if interval in INTRADAY_INTERVALS and not _validate_intraday_range(start_date, end_date, interval):
            return

        # 3. 根据用户是否输入了日期，调用不同的抓取参数
        if start_date and end_date:
            # 指定日期范围抓取
            df = yf.download(ticker, start=start_date, end=end_date, interval=interval)
            filename = _build_filename(ticker, start_date, end_date, None, interval)
        else:
            # 默认抓取最近一个月；分钟级数据则默认抓更短窗口，避免超出 Yahoo 的限制
            default_period = _get_default_period(interval)
            df = yf.download(ticker, period=default_period, interval=interval)
            filename = _build_filename(ticker, None, None, default_period, interval)

        # 4. 检查是否真的抓到了数据 (防止用户输入了不存在的股票代码)
        if df.empty:
            print(f"警告：未能抓取到 {ticker} 的数据。请检查股票代码是否正确，或该时间段是否有交易。")
            return

        # 5. 将数据保存为 CSV 文件
        output_path = _get_output_path(filename)
        df.to_csv(output_path)
        print(f"成功！数据已成功保存到: {output_path}")

    except Exception as e:
        print(f"抓取过程中发生错误: {e}")

if __name__ == "__main__":
    fetch_custom_stock()