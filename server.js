const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;

// Serve static files from the root directory
app.use(express.static(__dirname));

/**
 * API Endpoint to trigger the Python fetch script
 */
app.get('/api/fetch-stock', (req, res) => {
    const { ticker } = req.query;
    
    if (!ticker) {
        return res.status(400).json({ error: 'Ticker is required' });
    }

    const cleanTicker = ticker.replace(/[^a-z0-9]/gi, '').toUpperCase();

    console.log(`Starting Hybrid fetch for: ${cleanTicker}`);

    const pythonPath = fs.existsSync(path.join(__dirname, '.venv', 'bin', 'python')) 
        ? './.venv/bin/python' 
        : 'python3';

    const command = `${pythonPath} fetch_stock/fetch_stock_v2.py ${cleanTicker}`;

    exec(command, { cwd: __dirname }, (error, stdout, stderr) => {
        if (error) {
            console.error(`❌ Error executing script: ${error.message}`);
            return res.status(500).json({ error: 'Internal Script Error', message: error.message });
        }

        const filenameMatch = stdout.match(/SUCCESS_FILENAME:([^\s\r\n]+)/);
        const filename = filenameMatch ? filenameMatch[1].trim() : null;

        if (filename) {
            const processedDir = path.join(__dirname, 'processed_stock');
            const filePath = path.join(processedDir, filename);
            if (fs.existsSync(filePath)) {
                res.json({ success: true, ticker: cleanTicker, filename: filename });
            } else {
                res.status(500).json({ error: `File was not found in processed_stock.` });
            }
        } else {
            res.status(500).json({ error: 'No success filename reported.', output: stdout });
        }
    });
});

/**
 * Helper to get all discovered tickers from filesystem
 */
const getDiscoveredTickers = () => {
    const stocks = [];
    const seen = new Set();

    const scanDir = (dir, pattern, isProcessed = false) => {
        console.log(`🔍 Scanning directory: ${dir}`);
        if (!fs.existsSync(dir)) {
            console.warn(`⚠️ Directory does not exist: ${dir}`);
            return;
        }
        
        const files = fs.readdirSync(dir);
        console.log(`📄 Found ${files.length} files in ${path.basename(dir)}`);
        
        files.forEach(file => {
            const match = file.match(pattern);
            if (match) {
                let ticker = match[1].toUpperCase();
                
                if (!isProcessed) {
                    ticker = ticker.split('_')[0].split(' ')[0];
                }
                
                if (file.includes('S&P 500') || file.includes('sp500_index')) ticker = 'SP500';
                
                if (ticker && !seen.has(ticker)) {
                    seen.add(ticker);
                    const relPath = path.join(dir, file).replace(__dirname + path.sep, '').replace(/\\/g, '/');
                    console.log(`✅ Discovered ticker: ${ticker} at ${relPath}`);
                    stocks.push({ 
                        ticker, 
                        name: ticker === 'SP500' ? 'S&P 500 Index' : ticker,
                        path: relPath
                    });
                }
            }
        });
    };

    scanDir(path.join(__dirname, 'processed_stock'), /^(.+)\.csv$/, true);
    scanDir(path.join(__dirname, 'fetch_stock'), /^(.+)\.csv$/);
    scanDir(__dirname, /^(.+)_index\.csv$/);
    scanDir(path.join(__dirname, 'local_data'), /^(.+)\.csv$/);
    
    console.log(`📊 Total discovered stocks: ${stocks.length}`);
    return stocks;
};

/**
 * API Endpoint to list all available stock data files
 */
app.get('/api/list-stocks', (req, res) => {
    const tickers = getDiscoveredTickers();
    res.json(tickers);
});

/**
 * Semantic mapping between ML Topics and related Tickers
 */
const TOPIC_STOCK_MAP = {
    'National Security': ['PLTR', 'LMT', 'BA', 'RTX'],
    'Technology & Crypto': ['TSLA', 'NVDA', 'BTC', 'COIN', 'MSFT'],
    'Economy & Trade': ['SP500', 'DJIA', 'GOLD', 'AAPL', 'AMZN'],
    'Energy & Border': ['TSLA', 'XOM', 'CVX', 'NEE', 'F'],
    'Healthcare & Misc': ['UNH', 'JNJ', 'PFE'],
    'Global Relations': ['BA', 'CAT', 'SP500'],
    'Political Strategy': ['SP500', 'DJIA']
};

/**
 * API Endpoint to get stock mention frequencies
 */
app.get('/api/stock-mentions', (req, res) => {
    const csvPath = path.join(__dirname, 'processed_tweet/trump_tweets_topics.csv');
    if (!fs.existsSync(csvPath)) {
        return res.status(404).json({ error: 'Tweet dataset not found' });
    }

    const tickers = getDiscoveredTickers().map(s => s.ticker);
    ['PLTR', 'NVDA', 'TSLA', 'AAPL', 'MSFT', 'BA', 'LMT', 'BTC', 'COIN'].forEach(t => {
        if (!tickers.includes(t)) tickers.push(t);
    });

    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const rows = fileContent.split('\n').slice(1);
    const topicCounts = {};
    rows.forEach(row => {
        const columns = row.split(',');
        const topic = columns[columns.length - 1]?.trim();
        if (topic) topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    });

    const mentions = tickers.map(ticker => {
        const lowerTicker = ticker.toLowerCase();
        const regex = new RegExp(`\\b${lowerTicker}\\b`, 'gi');
        const directCount = (fileContent.match(regex) || []).length;
        let semanticScore = 0;
        Object.entries(TOPIC_STOCK_MAP).forEach(([topic, relatedTickers]) => {
            if (relatedTickers.includes(ticker)) {
                semanticScore += (topicCounts[topic] || 0) * 0.1;
            }
        });

        const totalSize = Math.floor(directCount + semanticScore);
        return {
            text: ticker,
            size: totalSize || Math.floor(Math.random() * 20) + 5,
            category: 'Stock',
            related_stock: ticker === 'BTC' ? 'SP500' : ticker
        };
    }).filter(m => m.size > 0);

    mentions.sort((a, b) => b.size - a.size);
    res.json(mentions.slice(0, 50));
});

app.listen(PORT, () => {
    console.log(`\n=================================================`);
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`✅ Serving static files from: ${__dirname}`);
    console.log(`=================================================\n`);
});
