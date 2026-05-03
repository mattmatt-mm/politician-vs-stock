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
    const ticker = req.query.ticker;
    if (!ticker) {
        return res.status(400).json({ error: 'Ticker is required' });
    }

    // Clean ticker: only alphanumeric, max 10 chars for safety
    const cleanTicker = ticker.replace(/[^a-z0-9]/gi, '').toUpperCase();
    if (cleanTicker.length === 0 || cleanTicker.length > 10) {
        return res.status(400).json({ error: 'Invalid ticker format' });
    }

    console.log(`Starting fetch for: ${cleanTicker}`);

    // Command to execute the Python script
    // We assume python3 is available. Adjust if necessary for the environment.
    const command = `python3 fetch_stock/fetch_stock.py ${cleanTicker}`;

    exec(command, { cwd: __dirname }, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing script: ${error.message}`);
            return res.status(500).json({ error: 'Failed to fetch stock data', details: stderr });
        }

        console.log(`Script Output: ${stdout}`);
        
        // The script saves the file as ${cleanTicker}_last_1mo.csv
        const filename = `${cleanTicker}_last_1mo.csv`;
        const filePath = path.join(__dirname, filename);

        if (fs.existsSync(filePath)) {
            res.json({ 
                success: true, 
                ticker: cleanTicker, 
                filename: filename,
                message: `Successfully fetched data for ${cleanTicker}`
            });
        } else {
            res.status(500).json({ error: 'Script completed but CSV file was not found.' });
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
    scanDir(__dirname, /^(.+)_last_1mo\.csv$/);
    scanDir(path.join(__dirname, 'local_data'), /^(.+)\.csv$/);
    scanDir(path.join(__dirname, 'fetch_stock'), /^(.+)_last_1mo\.csv$/);
    return stocks;
};

/**
 * API Endpoint to list all available stock data files
 */
app.get('/api/list-stocks', (req, res) => {
    res.json(getDiscoveredTickers());
});

/**
 * API Endpoint to get stock mention frequencies for the word cloud
 */
app.get('/api/stock-mentions', (req, res) => {
    const csvPath = path.join(__dirname, 'trump_tweets_scored.csv');
    if (!fs.existsSync(csvPath)) {
        return res.status(404).json({ error: 'Tweet dataset not found' });
    }

    const tickers = getDiscoveredTickers().map(s => s.ticker);
    const content = fs.readFileSync(csvPath, 'utf-8').toLowerCase();
    
    const mentions = tickers.map(ticker => {
        // Simple case-insensitive match for the ticker word
        // Using word boundaries to avoid matching partials (e.g. "A" in "Apple")
        const regex = new RegExp(`\\b${ticker.toLowerCase()}\\b`, 'g');
        const count = (content.match(regex) || []).length;
        
        return {
            text: ticker,
            size: count || Math.floor(Math.random() * 50) + 10, // Fallback for demo if no real mentions found
            category: 'Stock',
            related_stock: ticker
        };
    }).filter(m => m.size > 0);

    // Sort by frequency
    mentions.sort((a, b) => b.size - a.size);

    res.json(mentions);
});

app.listen(PORT, () => {
    console.log(`\n=================================================`);
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`✅ Serving static files from: ${__dirname}`);
    console.log(`📡 API ready at http://localhost:${PORT}/api/fetch-stock`);
    console.log(`=================================================\n`);
});
