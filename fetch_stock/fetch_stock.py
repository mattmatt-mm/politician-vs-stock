import yfinance as yf
import pandas as pd

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

    print(f"\n正在向雅虎财经请求 {ticker} 的数据，请稍候...")
    
    try:
        # 3. 根据用户是否输入了日期，调用不同的抓取参数
        if start_date and end_date:
            # 指定日期范围抓取
            df = yf.download(ticker, start=start_date, end=end_date)
            filename = f"{ticker}_{start_date}_to_{end_date}.csv"
        else:
            # 默认抓取最近一个月 (1mo = 1 month)
            df = yf.download(ticker, period="1mo")
            filename = f"{ticker}_last_1mo.csv"

        # 4. 检查是否真的抓到了数据 (防止用户输入了不存在的股票代码)
        if df.empty:
            print(f"警告：未能抓取到 {ticker} 的数据。请检查股票代码是否正确，或该时间段是否有交易。")
            return

        # 5. 将数据保存为 CSV 文件
        df.to_csv(filename)
        print(f"成功！数据已成功保存到当前目录下的: {filename}")

    except Exception as e:
        print(f"抓取过程中发生错误: {e}")

if __name__ == "__main__":
    fetch_custom_stock()