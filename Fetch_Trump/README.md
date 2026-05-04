# Fetch Trump Truth Social Data / 抓取 Trump Truth Social 数据

This folder contains scripts to fetch Truth Social posts for `@realDonaldTrump`.
本目录包含用于抓取 `@realDonaldTrump` Truth Social 帖子的脚本。

## 1) Quick Start (EN)

### Prerequisites
- Python 3.10+
- VPN/proxy that can access `truthsocial.com` (some IPs are blocked)

### Setup
1. Open terminal in this folder.
2. Create virtual environment:
   ```powershell
   python -m venv venv
   ```
3. Activate venv:
   ```powershell
   .\venv\Scripts\Activate.ps1
   ```
4. Install dependencies:
   ```powershell
   pip install -r requirements.txt
   ```

### Run scripts
- Connectivity check (recommended first):
  ```powershell
  python test_connection.py
  ```
- Incremental fetch (recommended for teamwork, appends safely):
  ```powershell
  python fetch_incremental.py
  ```
- Full fetch (legacy, not recommended for interrupted runs):
  ```powershell
  python fetch_truth_social.py
  ```

### Recommended team workflow
1. Pull latest code/data.
2. Run `python test_connection.py`.
3. If lookup endpoint returns 403, switch VPN node and retry.
4. Run `python fetch_incremental.py` once (or a few times).
5. Commit only updated dataset and script/config changes if any.

### Notes
- `fetch_incremental.py` reads the earliest existing post ID and fetches older posts, reducing duplicate risk.
- If a run fails from timeout/rate limit, rerun the same command.
- Do not commit virtual environment files (`venv/` is ignored).

## 2) 快速开始（中文）

### 前置要求
- Python 3.10+
- 能访问 `truthsocial.com` 的 VPN/代理（部分 IP 会被封）

### 环境配置
1. 在本目录打开终端。
2. 创建虚拟环境：
   ```powershell
   python -m venv venv
   ```
3. 激活虚拟环境：
   ```powershell
   .\venv\Scripts\Activate.ps1
   ```
4. 安装依赖：
   ```powershell
   pip install -r requirements.txt
   ```

### 脚本运行
- 先做连通性测试（推荐）：
  ```powershell
  python test_connection.py
  ```
- 增量抓取（团队协作推荐，可安全追加）：
  ```powershell
  python fetch_incremental.py
  ```
- 全量抓取（旧脚本，不建议中断场景使用）：
  ```powershell
  python fetch_truth_social.py
  ```

### 团队协作建议流程
1. 先 `pull` 最新代码和数据。
2. 先跑 `python test_connection.py`。
3. 如果 lookup 返回 403，先切 VPN 节点再重试。
4. 运行 `python fetch_incremental.py`（可多次）。
5. 只提交更新后的数据文件和必要脚本改动。

### 说明
- `fetch_incremental.py` 会读取现有 CSV 最早一条的 ID，继续向更早时间抓，降低重复风险。
- 如果遇到超时/限速失败，直接重跑同一命令即可。
- 不要提交虚拟环境文件（`venv/` 已被忽略）。

## 3) Git & Push FAQ

### Do I need a new VS Code window to push?
No. You can push from the current window as long as this folder is inside the Git repo (it is).

### 我要不要新开一个 VS Code 窗口再 push？
不用。当前窗口就可以 push，只要这个目录在 Git 仓库里（你现在这个就是）。

### Suggested commands / 建议命令
```powershell
git add Fetch_Trump
git commit -m "Add teammate setup guide and standardize Python project config"
git push
```

If your terminal is already inside this folder, these also work:
```powershell
git add .
git commit -m "Update fetch workflow docs and setup files"
git push
```
