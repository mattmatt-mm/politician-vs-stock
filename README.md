# PoliticianTrades — Trump Market Reflex

Interactive dashboard exploring tweet timing, keyword/topic emphasis, and short-horizon equity context (candlesticks with sentiment-style labels and abnormal-return summaries). Built as a static front end served by a small Express app.

## 1. Initial Setup (Prerequisites)

To run this dashboard, you need to install **Node.js** (which includes `npm`, the package manager we use to run the server).

**How to install Node.js:**
- **Mac / Windows**: Go to [nodejs.org](https://nodejs.org/) and download the "LTS" (Long Term Support) installer. Run the installer and follow the prompts.
- **Mac (Homebrew)**: If you are familiar with Homebrew, you can simply open your terminal and run `brew install node`.

**Verify Installation:**
Open your terminal (Terminal on Mac, Command Prompt/PowerShell on Windows) and type:
```bash
node -v
npm -v
```
If both commands print a version number (e.g., `v18.x.x`), you are ready to go!

---

## 2. Start the App

1. **Open your terminal** and navigate to this project directory:
   ```bash
   cd path/to/politician-vs-stock
   ```
   *(Tip: On Mac, you can type `cd ` and drag the folder into the terminal window to get the path).*

2. **Install the required packages:**
   ```bash
   npm install
   ```
   *(This downloads the necessary tools like Express to run the local server).*

3. **Start the server:**
   ```bash
   npm start
   ```

4. **View the dashboard:**
   Open your web browser and navigate to:
   **[http://localhost:3001](http://localhost:3001)**

You should see the "Trump Market Reflex" dashboard with the candlestick view, word cloud, and related tweet panel.

---

## 3. (Optional) Python Setup for Fetching Live Data

If you want to use the "Add New Ticker" feature in the dashboard to fetch fresh stock data, you need **Python 3** installed. 

**How to install Python:**
- Go to [python.org/downloads](https://www.python.org/downloads/) and install the latest version.
- Or use Homebrew on Mac: `brew install python`

**Install Python Dependencies:**
Once Python is installed, open your terminal, navigate to the project folder, and run:
```bash
cd fetch_stock
pip3 install -r requirements.txt
```
*(If `pip3` doesn't work, try `pip install -r requirements.txt` or `python3 -m pip install -r requirements.txt`).*

That's it! Now when you search for a new ticker in the dashboard, the server will use Python to fetch the data and save it as a CSV file. If Python is not installed, the dashboard will still work perfectly using the local, pre-bundled data.

## API


| Method | Path                           | Description                                                                                         |
| ------ | ------------------------------ | --------------------------------------------------------------------------------------------------- |
| GET    | `/api/fetch-stock?ticker=NVDA` | Runs `fetch_stock/fetch_stock.py` for the given ticker; responds with JSON when the CSV is written. |


Static assets (HTML, JS, CSS, data files) are served from the project root.

## Project layout (high level)


| Path                                                      | Role                                 |
| --------------------------------------------------------- | ------------------------------------ |
| `index.html`, `style.css`                                 | Shell and styling                    |
| `script.js`, `wordCloud.js`                               | Charts, tweets, interactions         |
| `server.js`                                               | Express static server + fetch route  |
| `fetch_stock/`                                            | `fetch_stock.py`, `requirements.txt` |
| `trump_tweets_dataset.csv`, `*.json`, `unprocessed_data/` | Tweet and market inputs              |
| `design.md`, `scope.md`                                   | Design intent and scope notes        |


## Troubleshooting

- **Port in use:** Another process may be bound to `3001`. Stop it or temporarily change `PORT` in `server.js`.
- **Blank charts:** Confirm you opened `http://localhost:3001` (not `file://`). CDNs must load for D3 / chart libraries.
- **Fetch fails:** Check `python3` works and run `pip install -r fetch_stock/requirements.txt`; Yahoo Finance may rate-limit or block some networks.

