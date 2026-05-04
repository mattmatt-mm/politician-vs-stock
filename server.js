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
 * Usage: /api/fetch-stock?ticker=NVDA
 */
app.get('/api/fetch-stock', (req, res) => {
    const { ticker, startYear, endYear } = req.query;
    
    if (!ticker) {
        return res.status(400).json({ error: 'Ticker is required' });
    }

    const cleanTicker = ticker.replace(/[^a-z0-9]/gi, '').toUpperCase();
    const cleanStart = startYear ? startYear.replace(/[^0-9]/g, '') : '';
    const cleanEnd = endYear ? endYear.replace(/[^0-9]/g, '') : '';

    console.log(`Starting fetch for: ${cleanTicker} (${cleanStart} to ${cleanEnd}, Interval: 1h)`);

    // Use .venv python if it exists, otherwise fallback to python3
    const pythonPath = fs.existsSync(path.join(__dirname, '.venv', 'bin', 'python')) 
        ? './.venv/bin/python' 
        : 'python3';

    const command = `${pythonPath} fetch_stock/fetch_stock.py ${cleanTicker} "${cleanStart}" "${cleanEnd}"`;

    exec(command, { cwd: __dirname }, (error, stdout, stderr) => {
        if (error) {
            console.error(`❌ Error executing script: ${error.message}`);
            console.error(`❌ Stderr: ${stderr}`);
            return res.status(500).json({ 
                error: 'Internal Script Error', 
                message: error.message,
                details: stderr 
            });
        }

        console.log(`Script Output: ${stdout}`);
        
        // Extract filename using a stricter regex (no spaces or control chars)
        const filenameMatch = stdout.match(/SUCCESS_FILENAME:([^\s\r\n]+)/);
        const filename = filenameMatch ? filenameMatch[1].trim() : null;

        if (filename) {
            const fetchDir = path.join(__dirname, 'fetch_stock');
            const filePath = path.join(fetchDir, filename);
            const exists = fs.existsSync(filePath);
            
            console.log(`Checking file: ${filePath} -> exists: ${exists}`);

            if (exists) {
                res.json({ 
                    success: true, 
                    ticker: cleanTicker, 
                    filename: filename,
                    message: `Successfully fetched data for ${cleanTicker}`
                });
            } else {
                const filesInDir = fs.readdirSync(fetchDir);
                res.status(500).json({ 
                    error: `Script reported success but file was not found.`,
                    checkedPath: filePath,
                    filename: filename,
                    directoryContents: filesInDir
                });
            }
        } else {
            res.status(500).json({ error: 'Script completed but no success filename was reported.', output: stdout });
        }
    });
});

/**
 * Helper to get all discovered tickers from filesystem
 */
const getDiscoveredTickers = () => {
    const stocks = [];
    const seen = new Set();

    const scanDir = (dir, pattern, tickerOverride = null) => {
        if (!fs.existsSync(dir)) return;
        const files = fs.readdirSync(dir);
        files.forEach(file => {
            const match = file.match(pattern);
            if (match || tickerOverride) {
                let ticker = tickerOverride;
                if (!ticker && match) {
                    ticker = match[1].toUpperCase().split('_')[0].split(' ')[0];
                    // Special case for S&P 500
                    if (file.includes('S&P 500')) ticker = 'SP500';
                }
                
                if (ticker && !seen.has(ticker)) {
                    seen.add(ticker);
                    stocks.push({ 
                        ticker, 
                        name: ticker === 'SP500' ? 'S&P 500 Index' : ticker,
                        path: path.join(dir, file).replace(__dirname + path.sep, '').replace(/\\/g, '/') 
                    });
                }
            }
        });
    };

    scanDir(__dirname, /^(.+)_index\.csv$/);
    scanDir(__dirname, /^(.+)\.csv$/);
    scanDir(path.join(__dirname, 'local_data'), /^(.+)\.csv$/);
    scanDir(path.join(__dirname, 'fetch_stock'), /^(.+)\.csv$/);
    return stocks;
};

/**
 * API Endpoint to list all available stock data files
 */
app.get('/api/list-stocks', (req, res) => {
    res.json(getDiscoveredTickers());
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
 * API Endpoint to get stock mention frequencies for the word cloud
 * Uses both direct mentions and semantic topic associations.
 */
app.get('/api/stock-mentions', (req, res) => {
    const csvPath = path.join(__dirname, 'data/ml/trump_tweets_topics.csv');
    if (!fs.existsSync(csvPath)) {
        return res.status(404).json({ error: 'Tweet dataset not found' });
    }

    const tickers = getDiscoveredTickers().map(s => s.ticker);
    // Add some common stocks for a better cloud if they aren't discovered
    ['PLTR', 'NVDA', 'TSLA', 'AAPL', 'MSFT', 'BA', 'LMT', 'BTC', 'COIN'].forEach(t => {
        if (!tickers.includes(t)) tickers.push(t);
    });

    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const rows = fileContent.split('\n').slice(1);
    
    // 1. Calculate Topic Frequencies
    const topicCounts = {};
    rows.forEach(row => {
        const columns = row.split(',');
        const topic = columns[columns.length - 1]?.trim(); // dominant_topic is last
        if (topic) {
            topicCounts[topic] = (topicCounts[topic] || 0) + 1;
        }
    });

    // 2. Calculate Ticker Scores
    const mentions = tickers.map(ticker => {
        const lowerTicker = ticker.toLowerCase();
        
        // Direct mentions in text
        const regex = new RegExp(`\\b${lowerTicker}\\b`, 'gi');
        const directCount = (fileContent.match(regex) || []).length;
        
        // Semantic scores from topics
        let semanticScore = 0;
        Object.entries(TOPIC_STOCK_MAP).forEach(([topic, relatedTickers]) => {
            if (relatedTickers.includes(ticker)) {
                // Add 10% of the topic's total volume as a "mention" score for this stock
                semanticScore += (topicCounts[topic] || 0) * 0.1;
            }
        });

        const totalSize = Math.floor(directCount + semanticScore);
        
        return {
            text: ticker,
            size: totalSize || Math.floor(Math.random() * 20) + 5,
            category: 'Stock',
            related_stock: ticker === 'BTC' ? 'SP500' : ticker // BTC uses S&P 500 as proxy for now
        };
    }).filter(m => m.size > 0);

    // Sort by frequency
    mentions.sort((a, b) => b.size - a.size);
    res.json(mentions.slice(0, 50)); // Limit to top 50
});

app.listen(PORT, () => {
    console.log(`\n=================================================`);
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`✅ Serving static files from: ${__dirname}`);
    console.log(`📡 API ready at http://localhost:${PORT}/api/fetch-stock`);
    console.log(`=================================================\n`);
});
