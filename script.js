const MARKET_KEYWORDS = {
    SP500: [
        'spy', 's&p', 'market', 'markets', 'stocks', 'economy', 'inflation',
        'rates', 'tariff', 'tariffs', 'tax', 'taxes', 'jobs', 'growth', 'fed'
    ],
    SPY: [
        'spy', 's&p', 'market', 'markets', 'stocks', 'economy', 'inflation',
        'rates', 'tariff', 'tariffs', 'tax', 'taxes', 'jobs', 'growth', 'fed'
    ],
    NVDA: [
        'nvda', 'nvidia', 'chip', 'chips', 'semiconductor', 'ai',
        'blackwell', 'rubin', 'tariff', 'tariffs'
    ],
    TSLA: [
        'tsla', 'tesla', 'musk', 'ev', 'electric', 'autonomous', 'fsd'
    ]
};

// Topic definitions are now loaded dynamically from data/ml/topic_definitions.json
window.TOPIC_DEFINITIONS = {};

const SENTIMENT_TERMS = {
    positive: [
        'all time high', 'all-time high', 'record high', 'record highs',
        'great news', 'great days', 'strongest economy', 'grow the economy',
        'growth', 'tax cuts', 'inflation is down', 'markets just hit',
        'best market', 'surge', 'surges', 'boom', 'working', 'victory',
        'jobs', 'manufacturing', 'strong', 'back', 'good', 'positive'
    ],
    negative: [
        'tariff', 'tariffs', 'sanctions', 'trade war', 'crash', 'disaster',
        'devastating', 'hurt', 'hurting', 'threat', 'shutdown', 'choking',
        'grave economic danger', 'market cap destruction', 'lost', 'violate',
        'violated', 'death traps', 'inflation', 'retaliatory'
    ]
};

const SENTIMENT_META = {
    positive: { label: 'Positive', color: '#10B981', title: 'P' },
    negative: { label: 'Negative', color: '#E11D48', title: 'N' },
    neutral: { label: 'Neutral', color: '#A1A1AA', title: 'T' }
};

const IMPACT_BAND_META = {
    'strong-negative': { label: 'Strong Negative', shortLabel: 'Strong Down' },
    negative: { label: 'Negative', shortLabel: 'Down' },
    neutral: { label: 'Neutral', shortLabel: 'Flat' },
    positive: { label: 'Positive', shortLabel: 'Up' },
    'strong-positive': { label: 'Strong Positive', shortLabel: 'Strong Up' }
};

const TWEET_YEAR_MIN = 2024;
const TWEET_YEAR_MAX = 2025;

class ReflexChart {
    constructor(containerId) {
        this.containerId = containerId;
        this.tooltip = document.getElementById('chart-tooltip');
        this.tweets = [];
        this.chartEngine = 'highcharts';
        this.currentTicker = 'SP500';
        this.currentYear = '2025';
        this.currentStockData = [];
        this.currentEvents = [];
        this.currentBenchmarkData = [];
        this.showVerticalLines = false;
        this.selectedEventId = null;
        this.currentWindowMs = null;

        this.sciChartSurface = null;
        this.wasmContext = null;
        this.xAxis = null;
        this.yAxis = null;
        this.sciChartInitPromise = null;
        this.highChart = null;

        this.container = document.getElementById(containerId);
        this.sciChartContainerId = `${containerId}-scichart`;
        this.highchartsContainerId = `${containerId}-highcharts`;

        this.ensureChartContainers();
        this.sciChartInitPromise = this.initSciChart();
    }

    ensureChartContainers() {
        if (!this.container) return;

        if (!document.getElementById(this.sciChartContainerId)) {
            const sciChartNode = document.createElement('div');
            sciChartNode.id = this.sciChartContainerId;
            sciChartNode.className = 'chart-engine-surface';
            sciChartNode.hidden = true;
            this.container.appendChild(sciChartNode);
        }

        if (!document.getElementById(this.highchartsContainerId)) {
            const highchartsNode = document.createElement('div');
            highchartsNode.id = this.highchartsContainerId;
            highchartsNode.className = 'chart-engine-surface';
            this.container.appendChild(highchartsNode);
        }
    }

    async initSciChart() {
        if (!window.SciChart || this.sciChartSurface) return;

        const {
            SciChartSurface,
            NumericAxis,
            DateTimeNumericAxis,
            SciChartJsNavyTheme,
            ZoomPanModifier,
            RolloverModifier,
            ZoomExtentsModifier,
            NumberRange
        } = SciChart;

        try {
            const { sciChartSurface, wasmContext } = await SciChartSurface.create(this.sciChartContainerId, {
                theme: new SciChartJsNavyTheme()
            });

            this.sciChartSurface = sciChartSurface;
            this.wasmContext = wasmContext;

            const XAxis = DateTimeNumericAxis || NumericAxis;
            this.xAxis = new XAxis(wasmContext, {
                growBy: new NumberRange(0, 0.02),
                drawMajorGridLines: false,
                drawMinorGridLines: false
            });
            this.yAxis = new NumericAxis(wasmContext, {
                growBy: new NumberRange(0.1, 0.1),
                labelPrecision: 2,
                cursorTextFormatting: (val) => val.toFixed(2)
            });

            sciChartSurface.xAxes.add(this.xAxis);
            sciChartSurface.yAxes.add(this.yAxis);

            sciChartSurface.chartModifiers.add(
                new ZoomPanModifier({ enableZoom: false }),
                new RolloverModifier({ showTooltip: true, showRolloverLine: true }),
                new ZoomExtentsModifier()
            );
        } catch (e) {
            console.error('SciChart initialization failed', e);
        }
    }

    async loadTweets() {
        if (this.tweets.length > 0) return this.tweets;

        try {
            const data = await d3.csv('data/ml/trump_tweets_topics.csv?v=' + Date.now());
            this.tweets = data
                .map(d => ({
                    id: d.id,
                    date: d3.isoParse(d.date),
                    text: this.cleanTweetText(d.text || ''),
                    platform: d.platform,
                    postUrl: d.post_url,
                    deleted: String(d.deleted_flag).toLowerCase() === 'true',
                    sentimentDirection: d.sentiment_direction || 'neutral',
                    sentimentScore: parseFloat(d.sentiment_score) || 0,
                    topic: d.dominant_topic,
                    positivity: parseFloat(d.vader_positivity) || 0,
                    tbPolarity: parseFloat(d.textblob_polarity) || 0,
                    tbSubjectivity: parseFloat(d.textblob_subjectivity) || 0,
                    combinedScore: parseFloat(d.combined_sentiment) || 0
                }))
                .filter(tweet => {
                    if (!tweet.date || Number.isNaN(tweet.date.getTime()) || tweet.deleted) return false;
                    const year = tweet.date.getFullYear();
                    const yearMatch = this.currentYear === 'all' || year === parseInt(this.currentYear, 10);
                    return yearMatch && year >= TWEET_YEAR_MIN && year <= TWEET_YEAR_MAX;
                });

            return this.tweets;
        } catch (e) {
            console.error('Failed to load tweets', e);
            return [];
        }
    }

    cleanTweetText(text) {
        return text
            .replace(/\s+/g, ' ')
            .replace(/\s+([,.;:!?])/g, '$1')
            .trim();
    }

    async update(tickerSymbol, engine = this.chartEngine, year = this.currentYear) {
        const normalizedTicker = this.normalizeTicker(tickerSymbol);
        this.currentTicker = normalizedTicker;
        this.chartEngine = engine;
        this.currentYear = year;
        
        this.syncTickerSelector(normalizedTicker);
        this.syncYearSelector(year);

        try {
            // Reset cache when changing year to ensure fresh filtering
            this.tweets = []; 
            await this.loadTweets();
            this.currentStockData = await this.loadStockData(normalizedTicker);
            this.currentBenchmarkData = this.isSp500Ticker(normalizedTicker)
                ? []
                : await this.loadSp500IndexData();
            this.currentEvents = this.prepareTweetEvents(
                normalizedTicker,
                this.currentStockData,
                this.currentBenchmarkData
            );

            this.updateHeader(normalizedTicker);
            this.populateTweetStream(normalizedTicker, this.currentEvents);
            // Force range reset when changing ticker or year to fix "sticky range" bug
            await this.renderActiveChart(true);
        } catch (e) {
            console.error('Failed to update dashboard', e);
        }
    }

    normalizeTicker(tickerSymbol) {
        return tickerSymbol === 'SPY' ? 'SP500' : tickerSymbol;
    }

    isSp500Ticker(tickerSymbol) {
        return tickerSymbol === 'SP500' || tickerSymbol === 'SPY';
    }

    displayTickerLabel(tickerSymbol) {
        if (this.isSp500Ticker(tickerSymbol)) return 'S&P 500';
        return tickerSymbol;
    }

    syncTickerSelector(tickerSymbol) {
        const input = document.getElementById('stock-search-input');
        if (!input) return;
        // In the new combobox, we just update the input value.
        // We can't easily find the 'name' here without access to availableStocks,
        // so we just show the ticker or let the combobox logic handle it.
        if (tickerSymbol) input.value = tickerSymbol;
    }

    syncYearSelector(year) {
        const selector = document.getElementById('year-selector');
        if (!selector) return;
        selector.value = year;
    }

    async setChartEngine(engine) {
        if (!['scichart', 'highcharts'].includes(engine)) return;
        this.chartEngine = engine;
        await this.renderActiveChart();
    }

    async loadStockData(tickerSymbol) {
        if (this.isSp500Ticker(tickerSymbol)) {
            return this.loadSp500IndexData();
        }

        const possiblePaths = [
            `local_data/${tickerSymbol}_60min.csv`,
            `fetch_stock/${tickerSymbol}.csv`,
            `fetch_stock/${tickerSymbol}_last_1mo.csv`,
            `${tickerSymbol}_last_1mo.csv`,
            `local_data/${tickerSymbol}.csv`,
            `${tickerSymbol}.csv`
        ];

        // Add discovered paths from the server
        if (window.AVAILABLE_STOCKS) {
            const discovered = window.AVAILABLE_STOCKS.filter(s => s.ticker === tickerSymbol).map(s => s.path);
            possiblePaths.unshift(...discovered);
        }

        const uniquePaths = [...new Set(possiblePaths)];

        for (const path of uniquePaths) {
            try {
                const checkRes = await fetch(path, { method: 'HEAD' });
                if (checkRes.ok) {
                    const rawData = await d3.csv(path);
                    if (rawData && rawData.length > 0) {
                        const parsedData = rawData
                            .map(d => ({
                                date: this.parseMarketDate(d.Date || d.date || d.datetime),
                                open: parseFloat(d.Open || d.open),
                                high: parseFloat(d.High || d.high),
                                low: parseFloat(d.Low || d.low),
                                close: parseFloat(d.Close || d.close)
                            }))
                            .filter(d => {
                                if (!this.isValidCandle(d)) return false;
                                const year = d.date.getFullYear();
                                return this.currentYear === 'all' || year === parseInt(this.currentYear, 10);
                            })
                            .sort((a, b) => a.date - b.date);
                        
                        if (parsedData.length > 0) return parsedData;
                    }
                }
            } catch (e) {
                // Continue to next path
            }
        }

        console.log(`No local CSV found for ${tickerSymbol}, falling back to mock data.`);

        // Fallback to mockLibrary
        const response = await fetch('stock_data_mock.json');
        const mockLibrary = await response.json();
        const entry = mockLibrary[tickerSymbol] || mockLibrary.SP500 || mockLibrary.SPY;
        
        return entry.data
            .map(d => ({
                date: this.parseMarketDate(d.date),
                open: Number(d.open),
                high: Number(d.high),
                low: Number(d.low),
                close: Number(d.close)
            }))
            .filter(d => {
                const year = d.date.getFullYear();
                const yearMatch = this.currentYear === 'all' || year === parseInt(this.currentYear, 10);
                return this.isValidCandle(d) && yearMatch;
            })
            .sort((a, b) => a.date - b.date);
    }

    async loadSp500IndexData() {
        const rows = await d3.csv('local_data/sp500_index.csv');

        return rows
            .map(row => {
                const date = this.parseSp500IndexDate(row.Date);
                const close = Number(row.S_P500 || row['S&P500']);

                return {
                    date,
                    open: close,
                    high: close,
                    low: close,
                    close,
                    value: close,
                    chartType: 'line'
                };
            })
            .filter(d => {
                const year = d.date.getFullYear();
                const yearMatch = this.currentYear === 'all' || year === parseInt(this.currentYear, 10);
                return d.date && !Number.isNaN(d.date.getTime()) && Number.isFinite(d.close) && yearMatch;
            })
            .sort((a, b) => a.date - b.date);
    }

    parseSp500IndexDate(dateKey) {
        const [year, month, day] = String(dateKey).split('-').map(Number);
        if (!year || !month || !day) return new Date(dateKey);

        const offset = this.isNewYorkDst(year, month, day) ? '-04:00' : '-05:00';
        return new Date(`${dateKey}T16:00:00${offset}`);
    }

    async loadSp500AggregateData() {
        const rows = await d3.csv('sp500_2025_h1.csv');
        if (!rows.length) return [];

        const dateKeys = Object.keys(rows[0])
            .map(key => key.trim().match(/^(\d{2}-\d{2}-\d{4})_opening$/)?.[1])
            .filter(Boolean)
            .sort((a, b) => this.parseSp500SessionClose(a) - this.parseSp500SessionClose(b));

        const basesByTicker = new Map();
        rows.forEach(row => {
            const baseKey = dateKeys.find(dateKey => Number.isFinite(Number(row[`${dateKey}_opening`])));
            if (baseKey) {
                basesByTicker.set(row.ticker, Number(row[`${baseKey}_opening`]));
            }
        });

        return dateKeys.map(dateKey => {
            const components = rows
                .map(row => {
                    const base = basesByTicker.get(row.ticker);
                    const open = Number(row[`${dateKey}_opening`]);
                    const close = Number(row[`${dateKey}_closing`]);
                    const volume = Number(row[`${dateKey}_volume`]);

                    if (!base || !Number.isFinite(open) || !Number.isFinite(close)) return null;

                    return {
                        open: (open / base) * 1000,
                        close: (close / base) * 1000,
                        volume: Number.isFinite(volume) ? volume : 0
                    };
                })
                .filter(Boolean);

            if (!components.length) return null;

            const open = d3.mean(components, component => component.open);
            const close = d3.mean(components, component => component.close);

            return {
                date: this.parseSp500SessionClose(dateKey),
                open,
                high: Math.max(open, close),
                low: Math.min(open, close),
                close,
                volume: d3.sum(components, component => component.volume),
                constituentCount: components.length
            };
        })
            .filter(d => d && this.isValidCandle(d))
            .sort((a, b) => a.date - b.date);
    }

    parseSp500SessionClose(dateKey) {
        const [day, month, year] = dateKey.split('-').map(Number);
        const offset = this.isNewYorkDst(year, month, day) ? '-04:00' : '-05:00';
        return new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T16:00:00${offset}`);
    }

    isValidCandle(candle) {
        return candle.date instanceof Date
            && !Number.isNaN(candle.date.getTime())
            && [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite);
    }

    parseMarketDate(value) {
        if (value instanceof Date) return value;
        const normalized = String(value).trim().replace(' ', 'T');

        if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(normalized)) {
            return new Date(normalized);
        }

        const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
        if (!match) return new Date(normalized);

        const [, year, month, day] = match.map((part, index) => index === 0 ? part : Number(part));
        const offset = this.isNewYorkDst(year, month, day) ? '-04:00' : '-05:00';
        return new Date(`${normalized}${offset}`);
    }

    isNewYorkDst(year, month, day) {
        if (month < 3 || month > 11) return false;
        if (month > 3 && month < 11) return true;

        const nthSunday = (targetMonth, nth) => {
            const first = new Date(Date.UTC(year, targetMonth - 1, 1));
            const firstSunday = 1 + ((7 - first.getUTCDay()) % 7);
            return firstSunday + ((nth - 1) * 7);
        };

        if (month === 3) return day >= nthSunday(3, 2);
        return day < nthSunday(11, 1);
    }

    prepareTweetEvents(ticker, stockData, benchmarkData = []) {
        if (!stockData.length) return [];

        const minTime = stockData[0].date.getTime();
        const maxTime = stockData[stockData.length - 1].date.getTime();

        const events = this.tweets
            .filter(tweet => {
                const tweetTime = tweet.date.getTime();
                if (tweetTime < minTime || tweetTime > maxTime) return false;
                if (this.isSp500Ticker(ticker)) return true;

                const content = tweet.text.toLowerCase();
                return (MARKET_KEYWORDS[ticker] || []).some(keyword => content.includes(keyword));
            })
            .map(tweet => this.enrichTweet(tweet, ticker, stockData, benchmarkData))
            .sort((a, b) => a.date - b.date);

        return events.slice(-500); // Take the latest 500 for the selected year
    }

    enrichTweet(tweet, ticker, stockData, benchmarkData = []) {
        const sentiment = {
            direction: tweet.sentimentDirection,
            label: SENTIMENT_META[tweet.sentimentDirection].label,
            score: tweet.sentimentScore
        };
        const reaction = this.calculatePostMove(tweet.date, stockData, benchmarkData);

        return {
            ...tweet,
            sentiment,
            reaction,
            markerColor: SENTIMENT_META[sentiment.direction].color,
            markerTitle: SENTIMENT_META[sentiment.direction].title
        };
    }

    calculatePostMove(tweetDate, stockData, benchmarkData = []) {
        if (!stockData.length) return this.emptyReaction('n/a');

        const intervalMs = this.estimateIntervalMs(stockData);
        const targetMs = intervalMs <= 2 * 60 * 1000 ? 15 * 60 * 1000 : 3 * intervalMs;
        const horizonLabel = this.formatHorizonLabel(targetMs, intervalMs);
        const moveWindow = this.calculateWindowReturn(tweetDate, stockData, targetMs);

        if (!moveWindow) return this.emptyReaction('outside range', horizonLabel);

        const value = moveWindow.returnPct;
        const zScore = this.calculateVolatilityAdjustedScore(stockData, moveWindow.startIndex, moveWindow.endIndex);
        const abnormalReturn = this.canCalculateAbnormalReturn(stockData, benchmarkData)
            ? this.calculateAbnormalReturn(tweetDate, targetMs, value, benchmarkData)
            : null;
        const impactBand = this.classifyImpactBand(value, zScore);

        return {
            label: this.formatPercent(value),
            value,
            direction: value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral',
            horizonLabel,
            zScore,
            zLabel: Number.isFinite(zScore) ? `${zScore >= 0 ? '+' : ''}${zScore.toFixed(2)}σ` : 'n/a',
            abnormalReturn,
            abnormalLabel: Number.isFinite(abnormalReturn) ? this.formatPercent(abnormalReturn) : 'n/a',
            impactBand,
            impactLabel: IMPACT_BAND_META[impactBand].label,
            impactShortLabel: IMPACT_BAND_META[impactBand].shortLabel
        };
    }

    estimateIntervalMs(stockData) {
        if (stockData.length < 2) return 60 * 1000;
        const gaps = [];

        for (let i = 1; i < Math.min(stockData.length, 25); i += 1) {
            gaps.push(stockData[i].date.getTime() - stockData[i - 1].date.getTime());
        }

        return gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)] || 60 * 1000;
    }

    emptyReaction(label, horizonLabel = 'n/a') {
        return {
            label,
            value: null,
            direction: 'neutral',
            horizonLabel,
            zScore: null,
            zLabel: 'n/a',
            abnormalReturn: null,
            abnormalLabel: 'n/a',
            impactBand: 'neutral',
            impactLabel: IMPACT_BAND_META.neutral.label,
            impactShortLabel: IMPACT_BAND_META.neutral.shortLabel
        };
    }

    calculateWindowReturn(targetDate, stockData, targetMs) {
        const targetTime = targetDate.getTime();
        const startIndex = stockData.findIndex(candle => candle.date.getTime() >= targetTime);
        if (startIndex < 0) return null;

        const endTime = stockData[startIndex].date.getTime() + targetMs;
        let endIndex = stockData.findIndex((candle, index) => index >= startIndex && candle.date.getTime() >= endTime);
        if (endIndex < 0) endIndex = stockData.length - 1;
        if (endIndex <= startIndex) return null;

        const startClose = stockData[startIndex].close;
        const endClose = stockData[endIndex].close;
        if (!Number.isFinite(startClose) || !Number.isFinite(endClose) || startClose === 0) return null;

        return {
            startIndex,
            endIndex,
            returnPct: ((endClose - startClose) / startClose) * 100
        };
    }

    calculateVolatilityAdjustedScore(stockData, startIndex, endIndex) {
        const lookback = 20;
        const step = Math.max(1, endIndex - startIndex);
        if (startIndex < step) return null;

        const sample = [];
        for (let i = startIndex; i >= step && sample.length < lookback; i -= 1) {
            const earlier = stockData[i - step]?.close;
            const later = stockData[i]?.close;
            if (!Number.isFinite(earlier) || !Number.isFinite(later) || earlier === 0) continue;
            sample.push(((later - earlier) / earlier) * 100);
        }

        if (sample.length < 5) return null;

        const mean = sample.reduce((sum, value) => sum + value, 0) / sample.length;
        const variance = sample.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / sample.length;
        const volatility = Math.sqrt(variance);
        if (!Number.isFinite(volatility) || volatility < 0.01) return null;

        const currentMove = ((stockData[endIndex].close - stockData[startIndex].close) / stockData[startIndex].close) * 100;
        return currentMove / volatility;
    }

    canCalculateAbnormalReturn(stockData, benchmarkData) {
        if (!stockData.length || !benchmarkData.length) return false;
        const stockInterval = this.estimateIntervalMs(stockData);
        const benchmarkInterval = this.estimateIntervalMs(benchmarkData);
        const ratio = Math.max(stockInterval, benchmarkInterval) / Math.max(1, Math.min(stockInterval, benchmarkInterval));
        return ratio <= 2;
    }

    calculateAbnormalReturn(tweetDate, targetMs, stockReturn, benchmarkData) {
        const benchmarkMove = this.calculateWindowReturn(tweetDate, benchmarkData, targetMs);
        if (!benchmarkMove) return null;
        return stockReturn - benchmarkMove.returnPct;
    }

    classifyImpactBand(rawReturn, zScore) {
        if (Number.isFinite(zScore)) {
            if (zScore <= -2) return 'strong-negative';
            if (zScore <= -0.5) return 'negative';
            if (zScore < 0.5) return 'neutral';
            if (zScore < 2) return 'positive';
            return 'strong-positive';
        }

        if (rawReturn <= -1) return 'strong-negative';
        if (rawReturn <= -0.2) return 'negative';
        if (rawReturn < 0.2) return 'neutral';
        if (rawReturn < 1) return 'positive';
        return 'strong-positive';
    }

    formatPercent(value) {
        if (!Number.isFinite(value)) return 'n/a';
        return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
    }

    formatHorizonLabel(targetMs, intervalMs) {
        if (intervalMs <= 2 * 60 * 1000) return '15m';
        const steps = Math.max(1, Math.round(targetMs / intervalMs));
        return `${steps} candles`;
    }

    updateHeader(tickerSymbol) {
        const title = document.getElementById('dynamic-chart-title');
        const subtitle = document.getElementById('dynamic-chart-subtitle');
        if (!title || !subtitle) return;

        const displayTicker = this.displayTickerLabel(tickerSymbol);
        title.innerHTML = `${displayTicker} <span class="emphasis-italic">Reflex Analysis</span>`;

        const timeframe = this.isSp500Ticker(tickerSymbol)
            ? 'daily index'
            : tickerSymbol === 'NVDA' ? '60-minute' : '1-minute';
        const engineName = this.chartEngine === 'highcharts' ? 'Highcharts Stock' : 'SciChart.js';
        const yearLabel = this.currentYear === 'all' ? 'All Time' : this.currentYear;
        
        subtitle.textContent = `${yearLabel} ${timeframe} candles with Trump tweet timestamps. Drag to pan time. Engine: ${engineName}.`;
    }

    async renderActiveChart(forceResetRange = false) {
        this.updateHeader(this.currentTicker);
        this.toggleEngineContainers();

        // Capture current range to prevent "zoom jump" ONLY if not forcing a reset
        let range = null;
        if (!forceResetRange) {
            if (this.chartEngine === 'highcharts' && this.highChart) {
                const axis = this.highChart.xAxis[0];
                if (axis.min && axis.max) {
                    range = { min: axis.min, max: axis.max };
                }
            } else if (this.chartEngine === 'scichart' && this.xAxis && this.xAxis.visibleRange) {
                range = { 
                    min: this.xAxis.visibleRange.min * 1000, 
                    max: this.xAxis.visibleRange.max * 1000 
                };
            }
        }

        if (this.chartEngine === 'highcharts') {
            this.renderHighcharts(this.currentTicker, this.currentStockData, this.currentEvents, range);
            return;
        }

        await this.sciChartInitPromise;
        this.renderSciChart(this.currentTicker, this.currentStockData, this.currentEvents, range);
    }

    toggleEngineContainers() {
        const sciChartNode = document.getElementById(this.sciChartContainerId);
        const highchartsNode = document.getElementById(this.highchartsContainerId);
        if (!sciChartNode || !highchartsNode) return;

        sciChartNode.hidden = this.chartEngine !== 'scichart';
        highchartsNode.hidden = this.chartEngine !== 'highcharts';

        if (this.chartEngine === 'highcharts' && this.sciChartSurface) {
            this.sciChartSurface.invalidateElement();
        }
    }

    renderSciChart(ticker, data, events, preservedRange = null) {
        if (!this.sciChartSurface) return;
        
        if (!data.length) {
            this.sciChartSurface.renderableSeries.clear();
            this.sciChartSurface.annotations.clear();
            return;
        }

        if (this.isSp500Ticker(ticker)) {
            this.renderSciChartLine(ticker, data, events, preservedRange);
            return;
        }

        const {
            OhlcDataSeries,
            FastCandlestickRenderableSeries,
            EllipseAnnotation,
            ELabelPlacement,
            EHorizontalAnchorPoint,
            EVerticalAnchorPoint,
            ECoordinateMode,
            Thickness,
            NumberRange
        } = SciChart;

        this.sciChartSurface.renderableSeries.clear();
        this.sciChartSurface.annotations.clear();

        const xValues = data.map(d => Math.floor(d.date.getTime() / 1000));
        const dataSeries = new OhlcDataSeries(this.wasmContext, {
            xValues,
            openValues: data.map(d => d.open),
            highValues: data.map(d => d.high),
            lowValues: data.map(d => d.low),
            closeValues: data.map(d => d.close),
            dataSeriesName: `${ticker} Price`
        });

        this.sciChartSurface.renderableSeries.add(new FastCandlestickRenderableSeries(this.wasmContext, {
            dataSeries,
            strokeThickness: 1,
            dataPointWidth: 0.7,
            brushUp: '#10B981CC',
            brushDown: '#E11D48CC',
            strokeUp: '#10B981',
            strokeDown: '#E11D48'
        }));

        const visibleEvents = this.eventsInDataRange(events, data);
        visibleEvents.forEach(event => {
            const x = Math.floor(event.date.getTime() / 1000);
            const y = this.closestCandle(event.date, data)?.high || data[0].high;
            const meta = SENTIMENT_META[event.sentiment.direction];

            const isSelected = this.selectedEventId && event.id === this.selectedEventId;

            this.sciChartSurface.annotations.add(new EllipseAnnotation({
                id: `tweet-marker-${event.id}`,
                x1: x,
                y1: 0.98,
                width: 5,
                height: 5,
                yCoordinateMode: ECoordinateMode.Relative,
                fill: meta.color + (isSelected ? '' : '80'),
                stroke: 'transparent',
                horizontalAnchorPoint: EHorizontalAnchorPoint.Center,
                verticalAnchorPoint: EVerticalAnchorPoint.Center
            }));

            if (this.showVerticalLines || isSelected) {
                this.sciChartSurface.annotations.add(new SciChart.VerticalLineAnnotation({
                    x1: x,
                    stroke: meta.color + (isSelected ? '' : '33'),
                    strokeThickness: isSelected ? 2 : 1,
                    showLabel: false
                }));
            }
        });

        this.applyInitialSciChartRange(data, preservedRange);
    }

    renderSciChartLine(ticker, data, events, preservedRange = null) {
        if (!this.sciChartSurface || !data.length) return;

        const {
            XyDataSeries,
            FastLineRenderableSeries,
            EllipseAnnotation,
            ELabelPlacement,
            EHorizontalAnchorPoint,
            EVerticalAnchorPoint,
            ECoordinateMode,
            Thickness
        } = SciChart;

        this.sciChartSurface.renderableSeries.clear();
        this.sciChartSurface.annotations.clear();

        const brokenData = this.withLineBreaks(data);
        const dataSeries = new XyDataSeries(this.wasmContext, {
            xValues: brokenData.map(point => Math.floor(point.date.getTime() / 1000)),
            yValues: brokenData.map(point => point.break ? Number.NaN : point.close),
            dataSeriesName: `${ticker} Index`
        });

        this.sciChartSurface.renderableSeries.add(new FastLineRenderableSeries(this.wasmContext, {
            dataSeries,
            stroke: '#27272A',
            strokeThickness: 2
        }));

        const visibleEvents = this.eventsInDataRange(events, data);
        visibleEvents.forEach(event => {
            const x = Math.floor(event.date.getTime() / 1000);
            const y = this.closestCandle(event.date, data)?.close || data[0].close;
            const meta = SENTIMENT_META[event.sentiment.direction];

            const isSelected = this.selectedEventId && event.id === this.selectedEventId;

            this.sciChartSurface.annotations.add(new EllipseAnnotation({
                id: `tweet-marker-${event.id}`,
                x1: x,
                y1: 0.98,
                width: 5,
                height: 5,
                yCoordinateMode: ECoordinateMode.Relative,
                fill: meta.color + (isSelected ? '' : '80'),
                stroke: 'transparent',
                horizontalAnchorPoint: EHorizontalAnchorPoint.Center,
                verticalAnchorPoint: EVerticalAnchorPoint.Center
            }));

            if (this.showVerticalLines || isSelected) {
                this.sciChartSurface.annotations.add(new SciChart.VerticalLineAnnotation({
                    x1: x,
                    stroke: meta.color + (isSelected ? '' : '33'),
                    strokeThickness: isSelected ? 2 : 1,
                    showLabel: false
                }));
            }
        });

        this.applyInitialSciChartRange(data, preservedRange);
    }

    applyInitialSciChartRange(data, preservedRange = null) {
        if (!this.xAxis || !data.length) return;

        if (preservedRange) {
            this.xAxis.visibleRange = new SciChart.NumberRange(preservedRange.min / 1000, preservedRange.max / 1000);
            this.currentWindowMs = preservedRange.max - preservedRange.min;
            return;
        }

        const min = Math.floor(data[0].date.getTime() / 1000);
        const max = Math.floor(data[data.length - 1].date.getTime() / 1000);
        const dataSpan = max - min;
        const defaultSpan = this.defaultWindowMs(data) / 1000;

        if (dataSpan > defaultSpan) {
            this.xAxis.visibleRange = new SciChart.NumberRange(max - defaultSpan, max);
            this.currentWindowMs = defaultSpan * 1000;
        } else {
            this.sciChartSurface.zoomExtents();
            this.currentWindowMs = dataSpan * 1000;
        }
    }

    renderHighcharts(ticker, data, events, preservedRange = null) {
        const highchartsNode = document.getElementById(this.highchartsContainerId);
        if (!window.Highcharts || !highchartsNode) return;

        if (!data.length) {
            highchartsNode.innerHTML = `<div class="empty-state">No market data found for ${this.displayTickerLabel(ticker)} in ${this.currentYear}.</div>`;
            if (this.highChart) this.highChart.destroy();
            this.highChart = null;
            return;
        }

        if (this.isSp500Ticker(ticker)) {
            this.renderHighchartsLine(ticker, data, events, preservedRange);
            return;
        }

        const candleData = data.map(d => [
            d.date.getTime(),
            d.open,
            d.high,
            d.low,
            d.close
        ]);
        const visibleEvents = this.eventsInDataRange(events, data);
        const defaultWindow = this.defaultWindowMs(data);
        const max = data[data.length - 1].date.getTime();
        const min = preservedRange ? preservedRange.min : Math.max(data[0].date.getTime(), max - defaultWindow);
        const actualMax = preservedRange ? preservedRange.max : max;

        if (this.highChart) {
            this.highChart.destroy();
        }

        this.highChart = Highcharts.stockChart(this.highchartsContainerId, {
            chart: {
                backgroundColor: '#FFFFFF',
                animation: false,
                panning: { enabled: true, type: 'x' },
                panKey: null,
                spacing: [8, 8, 8, 8],
                zooming: {
                    type: 'x',
                    mouseWheel: { enabled: true },
                    singleTouch: true
                }
            },
            accessibility: { enabled: true },
            credits: { enabled: false },
            navigator: {
                enabled: true,
                adaptToUpdatedData: false,
                height: 34
            },
            scrollbar: { enabled: true },
            rangeSelector: { enabled: false },
            title: { text: null },
            legend: { enabled: false },
            xAxis: {
                min,
                max: actualMax,
                ordinal: false,
                crosshair: true,
                lineColor: '#E4E4E7',
                tickColor: '#E4E4E7',
                plotLines: visibleEvents.filter(event => {
                    return this.showVerticalLines || (this.selectedEventId && event.id === this.selectedEventId);
                }).map(event => {
                    const isSelected = this.selectedEventId && event.id === this.selectedEventId;
                    return {
                        value: event.date.getTime(),
                        color: SENTIMENT_META[event.sentiment.direction].color + (isSelected ? '' : '33'),
                        width: isSelected ? 2 : 1,
                        zIndex: isSelected ? 5 : 1
                    };
                }),
                events: {
                    afterSetExtremes: (e) => {
                        if (!e.trigger) return; // Prevent infinite loops from programmatic sets
                        const filteredEvents = this.currentEvents.filter(event => {
                            const time = event.date.getTime();
                            return time >= e.min && time <= e.max;
                        });
                        this.populateTweetStream(this.currentTicker, filteredEvents);
                    }
                }
            },
            yAxis: {
                opposite: true,
                gridLineColor: '#F4F4F5',
                labels: { style: { color: '#52525B' } }
            },
            tooltip: {
                split: false,
                shared: true,
                useHTML: true,
                borderColor: '#E4E4E7',
                formatter: function formatter() {
                    const point = this.point || this.points?.[0]?.point;
                    if (!point) return false;
                    if (point.series?.type === 'flags') {
                        return `
                            <strong>${Highcharts.dateFormat('%b %e, %Y %H:%M', point.x)}</strong><br>
                            ${point.text}
                        `;
                    }
                    return `
                        <strong>${Highcharts.dateFormat('%b %e, %Y %H:%M', point.x)}</strong><br>
                        Open ${point.open?.toFixed(2)} | High ${point.high?.toFixed(2)}<br>
                        Low ${point.low?.toFixed(2)} | Close ${point.close?.toFixed(2)}
                    `;
                }
            },
            plotOptions: {
                series: {
                    animation: false,
                    dataGrouping: { enabled: false },
                    states: { inactive: { opacity: 1 } }
                },
                candlestick: {
                    color: '#E11D48',
                    upColor: '#10B981',
                    lineColor: '#E11D48',
                    upLineColor: '#10B981'
                },
                flags: {
                    shape: 'circlepin',
                    y: -34,
                    allowOverlapX: true,
                    cursor: 'pointer',
                    point: {
                        events: {
                            click: (e) => {
                                if (e.point.id) this.highlightTweetInStream(e.point.id);
                            }
                        }
                    },
                    style: {
                        color: '#FFFFFF',
                        fontSize: '10px',
                        fontWeight: '700'
                    }
                }
            },
            series: [
                {
                    type: 'candlestick',
                    id: `${ticker}-candles`,
                    name: ticker,
                    data: candleData
                },
                ...this.highchartsFlagSeries(visibleEvents)
            ]
        });

        this.currentWindowMs = this.highChart.xAxis[0].max - this.highChart.xAxis[0].min;
        this.reflowActiveChart();
    }

    renderHighchartsLine(ticker, data, events, preservedRange = null) {
        const visibleEvents = this.eventsInDataRange(events, data);
        const defaultWindow = this.defaultWindowMs(data);
        const max = data[data.length - 1].date.getTime();
        const min = preservedRange ? preservedRange.min : Math.max(data[0].date.getTime(), max - defaultWindow);
        const actualMax = preservedRange ? preservedRange.max : max;
        const lineData = this.withLineBreaks(data).map(point => [
            point.date.getTime(),
            point.break ? null : point.close
        ]);

        if (this.highChart) {
            this.highChart.destroy();
        }

        this.highChart = Highcharts.stockChart(this.highchartsContainerId, {
            chart: {
                backgroundColor: '#FFFFFF',
                animation: false,
                panning: { enabled: true, type: 'x' },
                panKey: null,
                spacing: [8, 8, 8, 8],
                zooming: {
                    type: 'x',
                    mouseWheel: { enabled: true },
                    singleTouch: true
                }
            },
            accessibility: { enabled: true },
            credits: { enabled: false },
            navigator: {
                enabled: true,
                adaptToUpdatedData: false,
                height: 34
            },
            scrollbar: { enabled: true },
            rangeSelector: { enabled: false },
            title: { text: null },
            legend: { enabled: false },
            xAxis: {
                min,
                max: actualMax,
                ordinal: false,
                crosshair: true,
                lineColor: '#E4E4E7',
                tickColor: '#E4E4E7',
                plotLines: visibleEvents.filter(event => {
                    return this.showVerticalLines || (this.selectedEventId && event.id === this.selectedEventId);
                }).map(event => {
                    const isSelected = this.selectedEventId && event.id === this.selectedEventId;
                    return {
                        value: event.date.getTime(),
                        color: SENTIMENT_META[event.sentiment.direction].color + (isSelected ? '' : '33'),
                        width: isSelected ? 2 : 1,
                        zIndex: isSelected ? 5 : 1
                    };
                }),
                events: {
                    afterSetExtremes: (e) => {
                        if (!e.trigger) return;
                        const filteredEvents = this.currentEvents.filter(event => {
                            const time = event.date.getTime();
                            return time >= e.min && time <= e.max;
                        });
                        this.populateTweetStream(this.currentTicker, filteredEvents);
                    }
                }
            },
            yAxis: {
                opposite: true,
                gridLineColor: '#F4F4F5',
                labels: { style: { color: '#52525B' } }
            },
            tooltip: {
                split: false,
                shared: true,
                useHTML: true,
                borderColor: '#E4E4E7',
                formatter: function formatter() {
                    const point = this.point || this.points?.[0]?.point;
                    if (!point) return false;
                    if (point.series?.type === 'flags') {
                        return `
                            <strong>${Highcharts.dateFormat('%b %e, %Y %H:%M', point.x)}</strong><br>
                            ${point.text}
                        `;
                    }
                    return `
                        <strong>${Highcharts.dateFormat('%b %e, %Y', point.x)}</strong><br>
                        S&P 500 ${Number(point.y).toFixed(2)}
                    `;
                }
            },
            plotOptions: {
                series: {
                    animation: false,
                    connectNulls: false,
                    dataGrouping: { enabled: false },
                    states: { inactive: { opacity: 1 } }
                },
                flags: {
                    shape: 'circlepin',
                    y: -34,
                    allowOverlapX: true,
                    style: {
                        color: '#FFFFFF',
                        fontSize: '10px',
                        fontWeight: '700'
                    }
                }
            },
            series: [
                {
                    type: 'line',
                    id: `${ticker}-line`,
                    name: 'S&P 500',
                    data: lineData,
                    color: '#27272A',
                    lineWidth: 2,
                    marker: { enabled: false }
                },
                ...this.highchartsFlagSeries(visibleEvents, `${ticker}-line`)
            ]
        });

        this.currentWindowMs = this.highChart.xAxis[0].max - this.highChart.xAxis[0].min;
        this.reflowActiveChart();
    }

    highchartsFlagSeries(events, onSeriesId = `${this.currentTicker}-candles`) {
        return ['positive', 'negative', 'neutral']
            .map(direction => {
                const meta = SENTIMENT_META[direction];
                const data = events
                    .filter(event => event.sentiment.direction === direction)
                    .map(event => ({
                        x: event.date.getTime(),
                        id: event.id, // For bi-directional linking
                        title: '', // No text label
                        text: `${meta.label} tweet<br>${this.escapeHtml(event.text)}<br>Move: ${event.reaction.label} (${event.reaction.horizonLabel})<br>Impact: ${event.reaction.impactLabel}${event.reaction.abnormalReturn !== null ? `<br>Excess vs S&P: ${event.reaction.abnormalLabel}` : ''}<br>Combined: ${event.combinedScore.toFixed(2)}`,
                        fillColor: (this.selectedEventId && event.id === this.selectedEventId) ? meta.color : meta.color + '80'
                    }));

                return {
                    type: 'flags',
                    name: `${meta.label} tweets`,
                    data,
                    onSeries: undefined, 
                    shape: 'circlepin',
                    width: 5,
                    height: 5,
                    y: -5, // Closer to axis
                    color: 'transparent',
                    lineColor: 'transparent',
                    states: {
                        hover: { 
                            fillColor: meta.color,
                            width: 8,
                            height: 8
                        }
                    }
                };
            })
            .filter(series => series.data.length > 0);
    }

    eventsInDataRange(events, data) {
        if (!data.length) return [];
        const min = data[0].date.getTime();
        const max = data[data.length - 1].date.getTime();
        return events.filter(event => {
            const time = event.date.getTime();
            return time >= min && time <= max;
        });
    }

    closestCandle(date, data) {
        if (!data.length) return null;
        const target = date.getTime();
        return data.reduce((closest, candle) => {
            const distance = Math.abs(candle.date.getTime() - target);
            const closestDistance = Math.abs(closest.date.getTime() - target);
            return distance < closestDistance ? candle : closest;
        }, data[0]);
    }

    defaultWindowMs(data) {
        if (data.length < 2) return 90 * 60 * 1000;
        const interval = this.estimateIntervalMs(data);
        const candleCount = interval <= 2 * 60 * 1000 ? 90 : 80;
        return interval * candleCount;
    }

    withLineBreaks(data) {
        if (data.length < 2) return data;

        const oneDayMs = 24 * 60 * 60 * 1000;
        const maxContinuousGap = 3 * oneDayMs;
        const points = [data[0]];

        for (let index = 1; index < data.length; index += 1) {
            const previous = data[index - 1];
            const current = data[index];
            const gap = current.date.getTime() - previous.date.getTime();

            if (gap > maxContinuousGap) {
                points.push({
                    date: new Date(previous.date.getTime() + oneDayMs),
                    close: null,
                    break: true
                });
            }

            points.push(current);
        }

        return points;
    }

    panToDate(date) {
        const targetMs = date.getTime();

        if (this.chartEngine === 'highcharts' && this.highChart) {
            const axis = this.highChart.xAxis[0];
            const currentSpan = axis.max - axis.min;
            // Use 60 minute window (30m each side) or current window if it's smaller than full range
            const span = (currentSpan > 0 && currentSpan < (axis.dataMax - axis.dataMin)) ? currentSpan : 3600000;
            axis.setExtremes(targetMs - span / 2, targetMs + span / 2, true, false);
            this.currentWindowMs = span;
            return;
        }

        if (!this.xAxis || !window.SciChart) return;
        const currentRange = this.xAxis.visibleRange;
        const span = currentRange ? currentRange.max - currentRange.min : this.defaultWindowMs(this.currentStockData) / 1000;
        const targetSeconds = Math.floor(targetMs / 1000);
        this.xAxis.visibleRange = new SciChart.NumberRange(targetSeconds - span / 2, targetSeconds + span / 2);
        this.currentWindowMs = span * 1000;
    }

    reflowActiveChart() {
        window.requestAnimationFrame(() => {
            if (this.highChart) {
                this.highChart.reflow();
            }

            if (this.sciChartSurface) {
                this.sciChartSurface.invalidateElement();
            }
        });
    }

    populateTweetStream(tickerSymbol, eventsData) {
        const container = document.getElementById('tweet-stream-container');
        const subtitle = document.getElementById('tweet-stream-subtitle');
        if (!container) return;

        if (subtitle) {
            subtitle.textContent = `${eventsData.length} Trump posts in the loaded ${this.displayTickerLabel(tickerSymbol)} candle range. Click a post to pan the active chart to its timestamp.`;
        }

        if (eventsData.length === 0) {
            container.innerHTML = `<div class="empty-state">No Trump posts overlap the loaded ${this.displayTickerLabel(tickerSymbol)} candle range.</div>`;
            return;
        }

        container.innerHTML = '';

        eventsData.forEach(event => {
            const timeStr = d3.timeFormat('%b %d, %Y %H:%M')(event.date);
            const sentimentClass = `sentiment-${event.sentiment.direction}`;
            const reactionClass = `value-${event.reaction.direction}`;
            const impactClass = `impact-${event.reaction.impactBand}`;

            const card = document.createElement('div');
            card.className = `tweet-card ${sentimentClass}`;
            card.setAttribute('data-event-id', event.id);
            card.innerHTML = `
                <div class="tweet-card-header">
                    <div class="time-cluster">
                        <i data-lucide="message-square"></i>
                        <span>${timeStr}</span>
                    </div>
                    <span class="sentiment-badge ${sentimentClass}">${event.sentiment.label}</span>
                </div>
                <div class="tweet-card-content">
                    "${this.escapeHtml(event.text)}"
                </div>
                <div class="tweet-card-metrics">
                    <div class="tweet-card-metric">
                        <span class="label">Move</span>
                        <span class="val ${reactionClass}">${event.reaction.label}</span>
                    </div>
                    <div class="tweet-card-metric">
                        <span class="label">Impact</span>
                        <span class="val ${impactClass}">${event.reaction.impactShortLabel}</span>
                    </div>
                    <div class="tweet-card-metric">
                        <span class="label">Excess vs S&P</span>
                        <span class="val">${event.reaction.abnormalLabel}</span>
                    </div>
                    <div class="tweet-card-metric">
                        <span class="label">Horizon</span>
                        <span class="val">${event.reaction.horizonLabel}</span>
                    </div>
                    <div class="tweet-card-metric">
                        <span class="label">Polarity</span>
                        <span class="val">${event.tbPolarity.toFixed(2)}</span>
                    </div>
                    <div class="tweet-card-metric">
                        <span class="label">Positivity</span>
                        <span class="val">${(event.positivity * 100).toFixed(0)}%</span>
                    </div>
                    <div class="tweet-card-metric">
                        <span class="label">Combined</span>
                        <span class="val">${event.combinedScore.toFixed(2)}</span>
                    </div>
                    <div class="tweet-card-metric">
                        <span class="label">Impact Z-Score</span>
                        <span class="val">${event.reaction.zLabel}</span>
                    </div>
                </div>
            `;

            card.addEventListener('click', () => {
                this.selectedEventId = event.id;
                
                // Highlight visually
                document.querySelectorAll('.tweet-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                
                this.panToDate(event.date);
                this.renderActiveChart();
            });

            container.appendChild(card);
        });

        if (window.lucide) {
            lucide.createIcons();
        }
    }

    highlightTweetInStream(eventId) {
        this.selectedEventId = String(eventId);
        
        // Find the card in the DOM
        const card = document.querySelector(`.tweet-card[data-event-id="${this.selectedEventId}"]`);
        const container = document.getElementById('tweet-stream-container');
        
        if (card && container) {
            // Highlight visually
            document.querySelectorAll('.tweet-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            
            // Scroll to the card
            const topPos = card.offsetTop - container.offsetTop;
            container.scrollTo({
                top: topPos,
                behavior: 'smooth'
            });
        }
        
        // Refresh chart to show the new highlight line
        this.renderActiveChart();
    }

    filterEventsByTopic(topicName) {
        const topic = window.TOPIC_DEFINITIONS[topicName];
        if (!topic || !this.currentEvents) return;

        const filteredEvents = this.currentEvents.filter(event => {
            return event.topic === topicName;
        });

        this.renderFilteredStream(filteredEvents, `Topic: ${topicName}`);
    }

    filterEventsByKeyword(keyword) {
        if (!this.currentEvents) return;

        const query = keyword.toLowerCase();
        const filteredEvents = this.currentEvents.filter(event => {
            return event.text.toLowerCase().includes(query);
        });

        this.renderFilteredStream(filteredEvents, `Keyword: ${keyword}`);
    }

    renderFilteredStream(filteredEvents, label) {
        const displayTicker = this.displayTickerLabel(this.currentTicker);
        const subtitle = document.getElementById('tweet-stream-subtitle');
        if (subtitle) {
            subtitle.innerHTML = `Showing <strong>${filteredEvents.length}</strong> tweets matching <strong>${label}</strong> for <strong>${displayTicker}</strong>.`;
        }

        this.populateTweetStream(this.currentTicker, filteredEvents);
    }

    escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    resetDashboard() {
        if (window.selectTickerUI) {
            window.selectTickerUI('SP500', 'S&P 500 Index');
        } else {
            this.update('SP500');
        }

        this.currentYear = '2025';
        const yearSelector = document.getElementById('year-selector');
        if (yearSelector) yearSelector.value = '2025';

        if (window.resetWordCloud) {
            window.resetWordCloud();
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    window.reflexChart = new ReflexChart('candlestick-chart');

    // State management for stocks
    let availableStocks = [
        { ticker: 'SP500', name: 'S&P 500 Index' },
        { ticker: 'NVDA', name: 'NVIDIA Corp' }
    ];

    async function refreshStockList() {
        try {
            const res = await fetch('/api/list-stocks');
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    availableStocks = data;
                }
            }
        } catch (e) {
            console.warn('API /api/list-stocks unreachable, using defaults.');
        }
        window.AVAILABLE_STOCKS = availableStocks;
    }

    async function loadTopics() {
        try {
            const res = await fetch('data/ml/topic_definitions.json');
            if (res.ok) {
                window.TOPIC_DEFINITIONS = await res.json();
                if (window.updateWordCloud) window.updateWordCloud();
            }
        } catch (e) {
            console.error('Failed to load topic definitions:', e);
        }
    }

    await refreshStockList();
    await loadTopics();
    window.refreshStockList = refreshStockList;

    // DOM Elements
    const combobox = document.getElementById('stock-combobox');
    const input = document.getElementById('stock-search-input');
    const list = document.getElementById('stock-options-list');
    const modalOverlay = document.getElementById('stock-modal-overlay');
    const closeModalBtn = document.getElementById('close-modal');
    const modalTickerInput = document.getElementById('modal-ticker-input');
    const modalFetchBtn = document.getElementById('modal-fetch-btn');
    const modalLoader = document.getElementById('modal-loader');
    const modalStockList = document.getElementById('modal-stock-list');
    const engineSelector = document.getElementById('chart-engine-selector');
    const yearSelector = document.getElementById('year-selector');
    const modalStartDateInput = document.getElementById('modal-start-year');
    const modalEndDateInput = document.getElementById('modal-end-year');

    let selectedTicker = 'SP500';

    // UI: Modal Logic
    const openModal = () => {
        modalOverlay.style.display = 'flex';
        renderModalStockList();
        modalTickerInput.focus();
        list.style.display = 'none';
        combobox.classList.remove('open');
    };

    const closeModal = () => {
        modalOverlay.style.display = 'none';
        modalTickerInput.value = '';
    };

    const renderModalStockList = () => {
        modalStockList.innerHTML = '';
        availableStocks.forEach(s => {
            const li = document.createElement('li');
            li.className = 'modal-stock-item';
            li.innerHTML = `
                <span>${s.name}</span>
                <span class="ticker">${s.ticker}</span>
            `;
            li.onclick = () => {
                selectTicker(s.ticker, s.name);
                closeModal();
            };
            modalStockList.appendChild(li);
        });
    };

    // UI: Combobox Logic
    const selectTicker = async (ticker, name) => {
        selectedTicker = ticker;
        const stock = availableStocks.find(s => s.ticker === ticker);
        input.value = name || stock?.name || ticker;
        list.style.display = 'none';
        combobox.classList.remove('open');
        await window.reflexChart.update(ticker, engineSelector?.value || 'highcharts');
    };
    window.selectTickerUI = selectTicker;

    const renderOptions = (filter = '') => {
        const query = filter.toLowerCase();
        const filtered = availableStocks.filter(s => 
            s.ticker.toLowerCase().includes(query) || 
            s.name.toLowerCase().includes(query)
        );

        list.innerHTML = '';
        
        // Add matching stocks
        filtered.forEach(s => {
            const li = document.createElement('li');
            li.className = 'combobox-option';
            if (s.ticker === selectedTicker) li.classList.add('selected');
            li.innerHTML = `
                <span class="name-label">${s.name}</span>
                <span class="ticker-badge">${s.ticker}</span>
            `;
            li.onmousedown = (e) => {
                e.preventDefault(); // Prevent input from blurring and closing the list
                selectTicker(s.ticker, s.name);
            };
            list.appendChild(li);
        });

        // Always add 'Add New' at the bottom
        const addNewLi = document.createElement('li');
        addNewLi.className = 'combobox-option add-new-option';
        addNewLi.innerHTML = `
            <span>Add New Ticker...</span>
            <i data-lucide="plus-circle" style="width:14px; height:14px;"></i>
        `;
        addNewLi.onclick = (e) => {
            e.stopPropagation();
            openModal();
        };
        list.appendChild(addNewLi);
        
        if (window.lucide) lucide.createIcons();
        list.style.display = 'block';
    };

    // Event Listeners
    input.addEventListener('focus', () => {
        combobox.classList.add('open');
        // If the value matches the selected ticker's name, show all options instead of filtering
        const stock = availableStocks.find(s => s.ticker === selectedTicker);
        if (input.value === (stock?.name || selectedTicker)) {
            renderOptions('');
        } else {
            renderOptions(input.value);
        }
    });

    input.addEventListener('input', (e) => {
        renderOptions(e.target.value);
    });

    // Close dropdown on click outside
    document.addEventListener('click', (e) => {
        if (!combobox.contains(e.target)) {
            list.style.display = 'none';
            combobox.classList.remove('open');
        }
    });

    // Modal Events
    closeModalBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });

    modalFetchBtn.addEventListener('click', async () => {
        const ticker = modalTickerInput.value.trim().toUpperCase();
        if (!ticker) return;

        // Check if already exists
        if (availableStocks.some(s => s.ticker === ticker)) {
            alert(`${ticker} is already in your local storage.`);
            return;
        }

        modalLoader.style.display = 'flex';
        modalFetchBtn.disabled = true;

        try {
            const startYear = modalStartDateInput.value;
            const endYear = modalEndDateInput.value;
            
            let url = `/api/fetch-stock?ticker=${ticker}`;
            if (startYear) url += `&startYear=${startYear}`;
            if (endYear) url += `&endYear=${endYear}`;

            const res = await fetch(url);
            
            // Check if response is JSON
            const contentType = res.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const text = await res.text();
                console.error('Non-JSON response received:', text);
                throw new Error('Server returned an invalid response (HTML). Please ensure you are using port 3001 and not 3000.');
            }

            const data = await res.json();
            
            if (!res.ok) {
                let errorMsg = data.error || data.message || 'Fetch failed';
                if (data.checkedPath) {
                    errorMsg += `\n\nSearched at: ${data.checkedPath}\nFilename: ${data.filename}`;
                }
                throw new Error(errorMsg);
            }

            // Success: Add to list
            await refreshStockList();
            renderModalStockList();
            
            // Automatically select and close after small delay for feedback
            setTimeout(() => {
                selectTicker(data.ticker, data.ticker);
                closeModal();
                modalLoader.style.display = 'none';
                modalFetchBtn.disabled = false;
            }, 800);

        } catch (err) {
            console.error('Fetch error:', err);
            alert(`Error: ${err.message}`);
            modalLoader.style.display = 'none';
            modalFetchBtn.disabled = false;
        }
    });

    // Handle initial selection
    await selectTicker('SP500', 'S&P 500 Index');

    // Engine/Year Selectors
    if (engineSelector) {
        engineSelector.addEventListener('change', event => {
            window.reflexChart.setChartEngine(event.target.value);
        });
    }

    if (yearSelector) {
        yearSelector.addEventListener('change', event => {
            window.reflexChart.update(window.reflexChart.currentTicker, window.reflexChart.chartEngine, event.target.value);
        });
    }

    const verticalLinesToggle = document.getElementById('vertical-lines-toggle');
    if (verticalLinesToggle) {
        verticalLinesToggle.addEventListener('change', event => {
            window.reflexChart.showVerticalLines = event.target.checked;
            window.reflexChart.renderActiveChart();
        });
    }

    window.addEventListener('resize', () => {
        window.reflexChart.reflowActiveChart();
    });
});
