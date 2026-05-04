import requests
import csv
import time
import re
import html
from datetime import datetime

# ================= 配置区 =================
USERNAME = "realDonaldTrump"
BASE_URL = "https://truthsocial.com/api/v1"
OUTPUT_FILE = "trump_truth_social_2026.csv"
MAX_POSTS_TO_FETCH = 2000  # 你可以修改这个数字来抓取更多历史帖子

# 如果遇到地区限制，请设置为你的 VPN/代理 URL
# 例如: "http://127.0.0.1:7890" (ClashX/Clash)
PROXY_URL = None  # 设置为 None 表示不使用代理

# 伪装成真实的浏览器，防止被 Truth Social 的基础反爬拦截
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
    """
    清洗 Truth Social 返回的 HTML 格式内容，提取纯文本。
    """
    if not raw_html:
        return ""
    # 移除 HTML 标签 (例如 <p>, <br>)
    cleanr = re.compile('<.*?>')
    cleantext = re.sub(cleanr, ' ', raw_html)
    # 将 HTML 实体 (如 &amp;, &quot;) 转换回正常字符
    cleantext = html.unescape(cleantext)
    # 清理多余的空格和换行
    return cleantext.strip()

def get_account_id(username, session):
    """
    通过用户名获取 Truth Social 内部的 Account ID。
    """
    print(f"[*] 正在查找用户 @{username} 的 Account ID...")
    url = f"{BASE_URL}/accounts/lookup"
    params = {"acct": username}
    
    # 设置代理
    proxies = None
    if PROXY_URL:
        proxies = {
            "http": PROXY_URL,
            "https": PROXY_URL
        }
        print(f"[*] 使用代理: {PROXY_URL}")
    
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

def fetch_posts(account_id, max_posts, session):
    """
    分页抓取用户的帖子。
    """
    print(f"[*] 开始抓取帖子，目标数量: {max_posts}...")
    url = f"{BASE_URL}/accounts/{account_id}/statuses"
    
    # 设置代理
    proxies = None
    if PROXY_URL:
        proxies = {
            "http": PROXY_URL,
            "https": PROXY_URL
        }
    
    all_posts = []
    max_id = None  # 用于分页的游标
    retry_wait = 5  # 初始重试等待时间（秒）
    
    while len(all_posts) < max_posts:
        params = {
            "limit": 40,  # 每次请求最多 40 条
            "exclude_replies": "true", # 排除回复，只看他自己发的
        }
        if max_id:
            params["max_id"] = max_id # 传入上一次最后一条的 ID 进行翻页
            
        try:
            response = session.get(url, headers=HEADERS, params=params, proxies=proxies, timeout=10)
            
            # 检查是否触发速率限制
            if response.status_code == 429:
                print(f"[!] 触发速率限制，等待 {retry_wait} 秒后重试...")
                time.sleep(retry_wait)
                retry_wait = min(retry_wait * 2, 120)  # 指数退避，最多等120秒
                continue
            
            response.raise_for_status()
            posts = response.json()
            
            # 重置重试等待时间（成功请求后）
            retry_wait = 5
            
            if not posts:
                print("[!] 没有更多帖子了。")
                break
                
            for post in posts:
                # 提取我们需要的数据字段
                post_data = {
                    "id": post.get("id"),
                    "created_at": post.get("created_at"),
                    "content": clean_content(post.get("content")),
                    "reblogs_count": post.get("reblogs_count", 0),
                    "favourites_count": post.get("favourites_count", 0),
                    "url": post.get("url")
                }
                all_posts.append(post_data)
                max_id = post.get("id") # 更新游标
                
                if len(all_posts) >= max_posts:
                    break
                    
            print(f"    已抓取 {len(all_posts)} 条...")
            time.sleep(5) # 礼貌性延迟，防止被封 IP / 触发速率限制
            
        except requests.exceptions.RequestException as e:
            print(f"[-] 抓取帖子时出错: {e}")
            break
            
    return all_posts

def save_to_csv(posts, filename):
    """
    将抓取到的数据保存为 CSV 文件，方便后续和股票数据对齐。
    """
    if not posts:
        print("[-] 没有数据可保存。")
        return
        
    print(f"[*] 正在保存数据到 {filename}...")
    # 定义 CSV 的表头
    fieldnames = ["id", "created_at", "content", "reblogs_count", "favourites_count", "url"]
    
    try:
        with open(filename, mode='w', newline='', encoding='utf-8') as file:
            writer = csv.DictWriter(file, fieldnames=fieldnames)
            writer.writeheader()
            for post in posts:
                writer.writerow(post)
        print(f"[+] 保存成功！共 {len(posts)} 条数据。")
    except Exception as e:
        print(f"[-] 保存文件时出错: {e}")

if __name__ == "__main__":
    # 创建会话对象以复用连接
    session = requests.Session()
    session.headers.update(HEADERS)
    
    # 1. 获取账号 ID
    trump_id = get_account_id(USERNAME, session)
    
    if trump_id:
        # 2. 抓取帖子
        posts_data = fetch_posts(trump_id, MAX_POSTS_TO_FETCH, session)
        
        # 3. 保存到 CSV
        save_to_csv(posts_data, OUTPUT_FILE)
    
    # 关闭会话
    session.close()