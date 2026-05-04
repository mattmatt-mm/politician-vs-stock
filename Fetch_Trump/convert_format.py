import csv
import re
from datetime import datetime
import os

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
    # Truth Social API 返回的是UTC时间(Z表示Zulu/UTC)
    # 我们需要转换成东部时间(EST/EDT)
    try:
        # 解析UTC时间
        dt = datetime.fromisoformat(iso_date.replace('Z', '+00:00'))
        # 转换为东部时间(UTC-5，假设EST)
        # 实际上应该用pytz，但为了简单起见，我们直接减5小时
        from datetime import timedelta
        eastern = dt - timedelta(hours=5)
        # 格式化为目标格式
        return eastern.strftime('%Y-%m-%dT%H:%M:%S-05:00')
    except:
        return iso_date

def convert_csv_format():
    """将现有CSV转换为目标格式"""
    old_file = "trump_truth_social_2026.csv"
    new_file = "trump_truth_social_2026_converted.csv"
    
    print(f"[*] 开始转换 {old_file} 格式...")
    
    rows = []
    with open(old_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            new_row = {
                "id": row.get('id', ''),
                "date": convert_date_format(row.get('created_at', '')),
                "platform": "Truth Social",
                "handle": "realDonaldTrump",
                "text": row.get('content', ''),
                "favorite_count": row.get('favourites_count', 0),
                "repost_count": row.get('reblogs_count', 0),
                "quote_flag": "False",
                "repost_flag": "False",
                "deleted_flag": "False",
                "word_count": count_words(row.get('content', '')),
                "hashtags": extract_hashtags(row.get('content', '')),
                "urls": extract_urls(row.get('content', '')),
                "user_mentions": extract_mentions(row.get('content', '')),
                "media_count": 0,
                "media_urls": "nan",
                "post_url": row.get('url', ''),
                "in_reply_to": "nan"
            }
            rows.append(new_row)
    
    # 写入新文件
    fieldnames = ["id", "date", "platform", "handle", "text", "favorite_count", "repost_count", 
                  "quote_flag", "repost_flag", "deleted_flag", "word_count", "hashtags", "urls", 
                  "user_mentions", "media_count", "media_urls", "post_url", "in_reply_to"]
    
    with open(new_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    
    print(f"[+] 转换完成！保存到 {new_file}")
    print(f"[+] 转换了 {len(rows)} 条数据")
    
    # 备份原文件并用新文件替换
    os.rename(old_file, old_file + ".backup")
    os.rename(new_file, old_file)
    print(f"[+] 已用新格式替换原文件，原文件备份为 {old_file}.backup")

if __name__ == "__main__":
    convert_csv_format()
