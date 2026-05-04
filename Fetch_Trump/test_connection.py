import requests

# 测试 VPN 连接和 API 可访问性
print("[*] 测试网络连接...")

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

# 1. 检查 IP 地址
print("\n[1] 检查你的 IP 地址...")
try:
    response = requests.get("https://api.ipify.org?format=json", timeout=10)
    ip_info = response.json()
    print(f"    你的 IP: {ip_info['ip']}")
except Exception as e:
    print(f"    失败: {e}")

# 2. 检查是否能访问 Truth Social 主页
print("\n[2] 尝试访问 Truth Social 主页...")
try:
    response = requests.get("https://truthsocial.com", headers=HEADERS, timeout=10)
    print(f"    状态码: {response.status_code}")
    if response.status_code == 200:
        print("    ✓ 可以访问")
    else:
        print("    ✗ 被拒绝或重定向")
except Exception as e:
    print(f"    失败: {e}")

# 3. 尝试不同的 API 端点
print("\n[3] 尝试访问 API 端点...")
endpoints = [
    "https://truthsocial.com/api/v1/accounts/lookup?acct=realDonaldTrump",
    "https://truthsocial.com/api/v1/instance",
    "https://truthsocial.com/api/v1/statuses/1",
]

for endpoint in endpoints:
    try:
        response = requests.get(endpoint, headers=HEADERS, timeout=10)
        print(f"    {endpoint.split('/')[-1]}: {response.status_code}")
    except Exception as e:
        print(f"    {endpoint.split('/')[-1]}: {type(e).__name__}")

print("\n[*] 诊断完成")
