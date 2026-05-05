import requests
import csv
import time
import re
import html
from datetime import datetime, timedelta

# ================= 配置区 =================
USERNAME = "realDonaldTrump"
BASE_URL = "https://truthsocial.com/api/v1"
OUTPUT_FILE = "trump_truth_social_2026.csv"
BATCH_SIZE = 100  # 每批抓取100条，防止速率限制
MAX_TOTAL_PER_RUN = 1000  # 单次运行最多补齐1000条

# 如果遇到地区限制，请设置为你的 VPN/代理 URL
PROXY_URL = None

# 伪装成真实的浏览器
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
    "Referer": "https://truthsocial.com/",
    "Origin": "https://truthsocial.com",
    "Connection": "keep-alive",
    "DNT": "1"
}
# ==========================================

def clean_content(raw_html):
    """清洗 HTML 格式内容"""
    if not raw_html:
        return ""
    cleanr = re.compile('<.*?>')
    cleantext = re.sub(cleanr, ' ', raw_html)
    cleantext = html.unescape(cleantext)
    return cleantext.strip()

def extract_hashtags(text):
    """提取文本中的hashtags"""
    if not text:
        return ""
    hashtags = re.findall(r'#\w+', text)
    return ' '.join(hashtags) if hashtags else ""

def extract_urls(text):
    """提取文本中的URLs"""
    if not text:
        return ""
    urls = re.findall(r'https?://\S+', text)
    return urls[0] if urls else ""

def extract_mentions(text):
    """提取文本中的@提及"""
    if not text:
        return ""
    mentions = re.findall(r'@\w+', text)
    return ' '.join(mentions) if mentions else ""

def count_words(text):
    """计算文本词数"""
    if not text:
        return 0
    return len(text.split())

def convert_date_format(iso_date):
    """从 2026-04-24T06:45:19.074Z 转换到 2026-01-08T07:42:42-05:00 的格式"""
    try:
        dt = datetime.fromisoformat(iso_date.replace('Z', '+00:00'))
        eastern = dt - timedelta(hours=5)
        return eastern.strftime('%Y-%m-%dT%H:%M:%S-05:00')
    except:
        return iso_date

def get_account_id(username, session):
    """获取账号 ID"""
    print(f"[*] 正在查找用户 @{username} 的 Account ID...")
    url = f"{BASE_URL}/accounts/lookup"
    params = {"acct": username}
    
    proxies = None
    if PROXY_URL:
        proxies = {"http": PROXY_URL, "https": PROXY_URL}
    
    try:
        response = session.get(url, headers=HEADERS, params=params, proxies=proxies, timeout=10)
        response.raise_for_status()
        account_data = response.json()
        account_id = account_data.get("id")
        print(f"[+] 成功获取 Account ID: {account_id}")
        return account_id
    except requests.exceptions.RequestException as e:
        print(f"[-] 获取 Account ID 失败: {e}")
        return None

def get_earliest_post_id():
    """从现有CSV中读取最早的post ID（用于继续抓取）"""
    try:
        with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            if rows:
                # 最后一行是最早的数据
                earliest_id = rows[-1]['id']
                earliest_date = rows[-1]['date']
                print(f"[*] 找到现有最早数据: {earliest_date} (ID: {earliest_id})")
                return earliest_id
    except FileNotFoundError:
        print(f"[*] {OUTPUT_FILE} 不存在，将从头开始抓取")
    except Exception as e:
        print(f"[-] 读取现有数据失败: {e}")
    return None

def fetch_posts_batch(account_id, batch_size, session, start_from_id=None):
    """抓取一批帖子"""
    print(f"[*] 开始抓取一批帖子 (目标: {batch_size} 条)...")
    url = f"{BASE_URL}/accounts/{account_id}/statuses"
    
    proxies = None
    if PROXY_URL:
        proxies = {"http": PROXY_URL, "https": PROXY_URL}
    
    all_posts = []
    max_id = start_from_id
    retry_wait = 40  # 直接从40秒开始
    
    while len(all_posts) < batch_size:
        params = {
            "limit": 40,
            "exclude_replies": "true",
        }
        if max_id:
            params["max_id"] = max_id
            
        try:
            response = session.get(url, headers=HEADERS, params=params, proxies=proxies, timeout=10)
            
            if response.status_code == 429:
                print(f"[!] 触发速率限制，等待 {retry_wait} 秒...")
                time.sleep(retry_wait)
                retry_wait = 60  # 升级到60秒
                continue
            
            response.raise_for_status()
            posts = response.json()
            
            retry_wait = 40  # 重置为40秒
            
            if not posts:
                print("[!] 没有更多帖子了。")
                break
                
            for post in posts:
                text = clean_content(post.get("content", ""))
                post_data = {
                    "id": post.get("id"),
                    "date": convert_date_format(post.get("created_at", "")),
                    "platform": "Truth Social",
                    "handle": "realDonaldTrump",
                    "text": text,
                    "favorite_count": post.get("favourites_count", 0),
                    "repost_count": post.get("reblogs_count", 0),
                    "quote_flag": "False",
                    "repost_flag": "False",
                    "deleted_flag": "False",
                    "word_count": count_words(text),
                    "hashtags": extract_hashtags(text),
                    "urls": extract_urls(text),
                    "user_mentions": extract_mentions(text),
                    "media_count": 0,
                    "media_urls": "nan",
                    "post_url": post.get("url", ""),
                    "in_reply_to": "nan"
                }
                all_posts.append(post_data)
                max_id = post.get("id")
                
                if len(all_posts) >= batch_size:
                    break
                    
            print(f"    已获取 {len(all_posts)} 条...")
            time.sleep(10)  # 请求间隔改为10秒（更激进）
            
        except requests.exceptions.RequestException as e:
            print(f"[-] 抓取出错: {e}")
            break
    
    return all_posts

def append_to_csv(posts, filename):
    """追加数据到CSV"""
    if not posts:
        print("[-] 没有新数据可保存。")
        return
    
    print(f"[*] 正在追加 {len(posts)} 条数据到 {filename}...")
    fieldnames = ["id", "date", "platform", "handle", "text", "favorite_count", "repost_count", 
                  "quote_flag", "repost_flag", "deleted_flag", "word_count", "hashtags", "urls", 
                  "user_mentions", "media_count", "media_urls", "post_url", "in_reply_to"]
    
    file_exists = False
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            file_exists = True
    except FileNotFoundError:
        pass
    
    try:
        with open(filename, 'a', newline='', encoding='utf-8') as file:
            writer = csv.DictWriter(file, fieldnames=fieldnames)
            if not file_exists:
                writer.writeheader()
            for post in posts:
                writer.writerow(post)
        print(f"[+] 追加成功！共 {len(posts)} 条数据。")
    except Exception as e:
        print(f"[-] 保存文件时出错: {e}")

if __name__ == "__main__":
    session = requests.Session()
    session.headers.update(HEADERS)
    
    trump_id = get_account_id(USERNAME, session)
    
    if trump_id:
        earliest_id = get_earliest_post_id()
        current_start_id = earliest_id
        total_saved = 0
        batch_index = 1

        while True:
            remaining = MAX_TOTAL_PER_RUN - total_saved
            if remaining <= 0:
                print(f"[*] 已达到单次运行上限 {MAX_TOTAL_PER_RUN} 条，结束本次抓取")
                break

            print(f"[*] 第 {batch_index} 轮增量抓取开始...")
            request_batch_size = min(BATCH_SIZE, remaining)
            posts_data = fetch_posts_batch(trump_id, request_batch_size, session, start_from_id=current_start_id)

            if not posts_data:
                print("[!] 本轮没有获得新数据，停止本次抓取")
                break

            append_to_csv(posts_data, OUTPUT_FILE)
            total_saved += len(posts_data)
            current_start_id = posts_data[-1]["id"]
            batch_index += 1

            print(f"[+] 累计本次已补齐 {total_saved} 条数据")

            if total_saved >= MAX_TOTAL_PER_RUN:
                print(f"[*] 已达到单次运行上限 {MAX_TOTAL_PER_RUN} 条，结束本次抓取")
                break

            if len(posts_data) < request_batch_size:
                print("[*] 已经没有更多帖子可继续抓取，结束本次运行")
                break

        if total_saved:
            print(f"\n[+] 本次总共成功补齐了 {total_saved} 条数据")
            print(f"[*] 下次可以继续运行此脚本来继续补齐历史数据")
        else:
            print("[!] 本次没有获得新数据，稍后再试")
    
    session.close()
