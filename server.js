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

app.listen(PORT, () => {
    console.log(`\n=================================================`);
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`✅ Serving static files from: ${__dirname}`);
    console.log(`📡 API ready at http://localhost:${PORT}/api/fetch-stock`);
    console.log(`=================================================\n`);
});
