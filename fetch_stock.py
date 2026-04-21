import yfinance as yf
import pandas as pd

def fetch_nvda_60min():
    print("正在抓取 NVDA 60分钟线数据...")
    # yfinance 抓取 60m 数据最多只能抓最近 730 天，这里抓取最近的一段时期
    df = yf.download("NVDA", period="1y", interval="60m")
    
    if df.empty:
        print("未抓取到 NVDA 数据！")
        return

    # 清理多余的表头层级
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.droplevel(1)
        
    df.reset_index(inplace=True)
    
    # 提取需要的列并重命名为小写
    # yfinance 默认列名是 Datetime, Open, High, Low, Close, Volume
    df = df[['Datetime', 'Open', 'High', 'Low', 'Close']].copy()
    df.rename(columns={
        'Datetime': 'datetime',
        'Open': 'open',
        'High': 'high',
        'Low': 'low',
        'Close': 'close'
    }, inplace=True)
    
    # 去除时区信息，保持和 Matt 的时间格式一致 (YYYY-MM-DD HH:MM:SS)
    df['datetime'] = df['datetime'].dt.tz_localize(None)
    
    # 计算 % change = (close - open) / open * 100
    df['% change'] = ((df['close'] - df['open']) / df['open']) * 100
    
    # 保存为 CSV
    df.to_csv("NVDA_60min.csv", index=False)
    print("成功！已生成 NVDA_60min.csv")

def fetch_sp500_daily():
    print("正在抓取 S&P 500 日线数据...")
    # 抓取标普500指数 (^GSPC) 过去10年的数据
    df = yf.download("^GSPC", period="10y", interval="1d")
    
    if df.empty:
        print("未抓取到 S&P 500 数据！")
        return

    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.droplevel(1)
        
    df.reset_index(inplace=True)
    
    # 我们只需要 Date 和 Close，并将 Close 重命名为 S&P500
    df = df[['Date', 'Close']].copy()
    df.rename(columns={'Close': 'S&P500'}, inplace=True)
    
    # 确保日期格式为 YYYY-MM-DD
    df['Date'] = df['Date'].dt.strftime('%Y-%m-%d')
    
    # 保存为 CSV
    df.to_csv("sp500_index.csv", index=False)
    print("成功！已生成 sp500_index.csv")

if __name__ == "__main__":
    fetch_nvda_60min()
    fetch_sp500_daily()