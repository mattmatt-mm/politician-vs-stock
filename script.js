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
    ]
};

const TOPIC_DEFINITIONS = {
    'War & Defense': {
        keywords: ['war', 'military', 'defense', 'nato', 'missile', 'strike', 'conflict', 'russia', 'china', 'raytheon', 'lockheed', 'pentagon'],
        color: '#E11D48' // Red-ish for intensity
    },
    'Tariffs & Trade': {
        keywords: ['tariff', 'tariffs', 'tax', 'trade war', 'trade', 'sanctions', 'economy', 'manufacturing', 'protectionism', 'duties'],
        color: '#D97706' // Amber for economic caution
    },
    'Tech & AI': {
        keywords: ['nvidia', 'nvda', 'ai', 'chip', 'semiconductor', 'palantir', 'pltr', 'tech', 'innovation', 'apple', 'microsoft', 'google'],
        color: '#2563EB' // Blue for tech
    },
    'Immigration': {
        keywords: ['border', 'ice', 'migrant', 'immigration', 'wall', 'secure', 'deportation', 'asylum'],
        color: '#059669' // Green for land/border
    },
    'Politics': {
        keywords: ['biden', 'democrats', 'republican', 'election', 'judge', 'pardon', 'victory', 'crooked', 'fake news'],
        color: '#7C3AED' // Purple for politics
    }
};

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

const TWEET_YEAR_MIN = 2019;
const TWEET_YEAR_MAX = 2026;

class ReflexChart {
    constructor(containerId) {
        this.containerId = containerId;
        this.tooltip = document.getElementById('chart-tooltip');
        this.tweets = [];
        this.chartEngine = 'highcharts';
        this.currentTicker = 'SP500';
        this.currentYear = '2024';
        this.currentStockData = [];
        this.currentEvents = [];
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
            this.container.appendChild(sciChartNode);
        }

        if (!document.getElementById(this.highchartsContainerId)) {
            const highchartsNode = document.createElement('div');
            highchartsNode.id = this.highchartsContainerId;
            highchartsNode.className = 'chart-engine-surface';
            highchartsNode.hidden = true;
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
            const data = await d3.csv('trump_tweets_dataset.csv?v=2019-2025');
            this.tweets = data
                .map(d => ({
                    id: d.id,
                    date: d3.isoParse(d.date),
                    text: this.cleanTweetText(d.text || ''),
                    platform: d.platform,
                    postUrl: d.post_url,
                    deleted: String(d.deleted_flag).toLowerCase() === 'true'
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
            this.currentEvents = this.prepareTweetEvents(normalizedTicker, this.currentStockData);

            this.updateHeader(normalizedTicker);
            this.populateTweetStream(normalizedTicker, this.currentEvents);
            await this.renderActiveChart();
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
        const selector = document.getElementById('stock-selector');
        if (!selector) return;
        const hasOption = Array.from(selector.options).some(option => option.value === tickerSymbol);
        if (hasOption) selector.value = tickerSymbol;
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

        if (tickerSymbol === 'NVDA') {
            const rawData = await d3.csv('NVDA_60min.csv');
            return rawData
                .map(d => ({
                    date: this.parseMarketDate(d.datetime),
                    open: parseFloat(d.open),
                    high: parseFloat(d.high),
                    low: parseFloat(d.low),
                    close: parseFloat(d.close)
                }))
                .filter(d => {
                    const year = d.date.getFullYear();
                    const yearMatch = this.currentYear === 'all' || year === parseInt(this.currentYear, 10);
                    return this.isValidCandle(d) && yearMatch && year >= 2019;
                })
                .sort((a, b) => a.date - b.date);
        }

        const response = await fetch('stock_data_mock.json');
        const mockLibrary = await response.json();
        return (mockLibrary[tickerSymbol] || mockLibrary.SP500 || mockLibrary.SPY).data
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
        const rows = await d3.csv('sp500_index.csv');

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

    prepareTweetEvents(ticker, stockData) {
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
            .map(tweet => this.enrichTweet(tweet, ticker, stockData))
            .sort((a, b) => a.date - b.date);

        return events.slice(-500); // Take the latest 500 for the selected year
    }

    enrichTweet(tweet, ticker, stockData) {
        const sentiment = this.classifySentiment(tweet.text, ticker);
        const reaction = this.calculatePostMove(tweet.date, stockData);

        return {
            ...tweet,
            sentiment,
            reaction,
            markerColor: SENTIMENT_META[sentiment.direction].color,
            markerTitle: SENTIMENT_META[sentiment.direction].title
        };
    }

    classifySentiment(text, ticker) {
        const content = text.toLowerCase();
        let positiveScore = 0;
        let negativeScore = 0;

        SENTIMENT_TERMS.positive.forEach(term => {
            if (content.includes(term)) positiveScore += term.length > 10 ? 2 : 1;
        });

        SENTIMENT_TERMS.negative.forEach(term => {
            if (content.includes(term)) negativeScore += term.length > 10 ? 2 : 1;
        });

        if (this.isSp500Ticker(ticker) && content.includes('inflation is down')) positiveScore += 3;
        if (content.includes('tariffs are working') || content.includes('tariffs will create')) positiveScore += 2;
        if (content.includes('sanctions') || content.includes('retaliatory tariff')) negativeScore += 2;

        let direction = 'neutral';
        if (positiveScore > negativeScore) direction = 'positive';
        if (negativeScore > positiveScore) direction = 'negative';

        return {
            direction,
            label: SENTIMENT_META[direction].label,
            score: positiveScore - negativeScore
        };
    }

    calculatePostMove(tweetDate, stockData) {
        if (!stockData.length) return { label: 'n/a', value: null, direction: 'neutral' };

        const tweetTime = tweetDate.getTime();
        const startIndex = stockData.findIndex(candle => candle.date.getTime() >= tweetTime);
        if (startIndex < 0) return { label: 'outside range', value: null, direction: 'neutral' };

        const intervalMs = this.estimateIntervalMs(stockData);
        const targetMs = intervalMs <= 2 * 60 * 1000 ? 15 * 60 * 1000 : 3 * intervalMs;
        const endTime = stockData[startIndex].date.getTime() + targetMs;
        let endIndex = stockData.findIndex((candle, index) => index >= startIndex && candle.date.getTime() >= endTime);
        if (endIndex < 0) endIndex = stockData.length - 1;

        const startClose = stockData[startIndex].close;
        const endClose = stockData[endIndex].close;
        const value = ((endClose - startClose) / startClose) * 100;

        return {
            label: `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`,
            value,
            direction: value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral'
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

    async renderActiveChart() {
        this.updateHeader(this.currentTicker);
        this.toggleEngineContainers();

        if (this.chartEngine === 'highcharts') {
            this.renderHighcharts(this.currentTicker, this.currentStockData, this.currentEvents);
            return;
        }

        await this.sciChartInitPromise;
        this.renderSciChart(this.currentTicker, this.currentStockData, this.currentEvents);
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

    renderSciChart(ticker, data, events) {
        if (!this.sciChartSurface) return;
        
        if (!data.length) {
            this.sciChartSurface.renderableSeries.clear();
            this.sciChartSurface.annotations.clear();
            return;
        }

        if (this.isSp500Ticker(ticker)) {
            this.renderSciChartLine(ticker, data, events);
            return;
        }

        const {
            OhlcDataSeries,
            FastCandlestickRenderableSeries,
            TextAnnotation,
            VerticalLineAnnotation,
            ELabelPlacement,
            EHorizontalAnchorPoint,
            EVerticalAnchorPoint,
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

            this.sciChartSurface.annotations.add(new VerticalLineAnnotation({
                id: `tweet-line-${event.id}`,
                x1: x,
                stroke: meta.color,
                strokeThickness: 1,
                strokeDashArray: [4, 4],
                showLabel: true,
                labelValue: `${meta.label} tweet`,
                labelPlacement: ELabelPlacement.Top,
                axisLabelFill: meta.color
            }));

            this.sciChartSurface.annotations.add(new TextAnnotation({
                id: `tweet-marker-${event.id}`,
                x1: x,
                y1: y,
                text: event.markerTitle,
                fontSize: 12,
                textColor: '#FFFFFF',
                backgroundColor: meta.color,
                padding: Thickness.fromString('2 5 2 5'),
                horizontalAnchorPoint: EHorizontalAnchorPoint.Center,
                verticalAnchorPoint: EVerticalAnchorPoint.Bottom
            }));
        });

        this.applyInitialSciChartRange(data);
    }

    renderSciChartLine(ticker, data, events) {
        if (!this.sciChartSurface || !data.length) return;

        const {
            XyDataSeries,
            FastLineRenderableSeries,
            TextAnnotation,
            VerticalLineAnnotation,
            ELabelPlacement,
            EHorizontalAnchorPoint,
            EVerticalAnchorPoint,
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

            this.sciChartSurface.annotations.add(new VerticalLineAnnotation({
                id: `tweet-line-${event.id}`,
                x1: x,
                stroke: meta.color,
                strokeThickness: 1,
                strokeDashArray: [4, 4],
                showLabel: true,
                labelValue: `${meta.label} tweet`,
                labelPlacement: ELabelPlacement.Top,
                axisLabelFill: meta.color
            }));

            this.sciChartSurface.annotations.add(new TextAnnotation({
                id: `tweet-marker-${event.id}`,
                x1: x,
                y1: y,
                text: event.markerTitle,
                fontSize: 12,
                textColor: '#FFFFFF',
                backgroundColor: meta.color,
                padding: Thickness.fromString('2 5 2 5'),
                horizontalAnchorPoint: EHorizontalAnchorPoint.Center,
                verticalAnchorPoint: EVerticalAnchorPoint.Bottom
            }));
        });

        this.applyInitialSciChartRange(data);
    }

    applyInitialSciChartRange(data) {
        if (!this.xAxis || !data.length) return;

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

    renderHighcharts(ticker, data, events) {
        const highchartsNode = document.getElementById(this.highchartsContainerId);
        if (!window.Highcharts || !highchartsNode) return;

        if (!data.length) {
            highchartsNode.innerHTML = `<div class="empty-state">No market data found for ${this.displayTickerLabel(ticker)} in ${this.currentYear}.</div>`;
            if (this.highChart) this.highChart.destroy();
            this.highChart = null;
            return;
        }

        if (this.isSp500Ticker(ticker)) {
            this.renderHighchartsLine(ticker, data, events);
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
        const min = Math.max(data[0].date.getTime(), max - defaultWindow);

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
                max,
                ordinal: false,
                crosshair: true,
                lineColor: '#E4E4E7',
                tickColor: '#E4E4E7',
                events: {
                    afterSetExtremes: (e) => {
                        if (!e.trigger) return; // Prevent infinite loops from programmatic sets
                        const filteredEvents = this.currentEvents.filter(event => {
                            const time = event.date.getTime();
                            return time >= e.min && time <= e.max;
                        });
                        this.populateTweetStream(this.currentTicker, filteredEvents);
                    }
                },
                plotLines: visibleEvents.map(event => ({
                    id: `tweet-line-${event.id}`,
                    value: event.date.getTime(),
                    color: event.markerColor,
                    width: 1,
                    dashStyle: 'ShortDash',
                    zIndex: 4,
                    label: {
                        text: event.markerTitle,
                        rotation: 0,
                        y: 12,
                        style: {
                            color: event.markerColor,
                            fontWeight: '700',
                            fontSize: '10px'
                        }
                    }
                }))
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

    renderHighchartsLine(ticker, data, events) {
        const visibleEvents = this.eventsInDataRange(events, data);
        const defaultWindow = this.defaultWindowMs(data);
        const max = data[data.length - 1].date.getTime();
        const min = Math.max(data[0].date.getTime(), max - defaultWindow);
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
                max,
                ordinal: false,
                crosshair: true,
                lineColor: '#E4E4E7',
                tickColor: '#E4E4E7',
                events: {
                    afterSetExtremes: (e) => {
                        if (!e.trigger) return;
                        const filteredEvents = this.currentEvents.filter(event => {
                            const time = event.date.getTime();
                            return time >= e.min && time <= e.max;
                        });
                        this.populateTweetStream(this.currentTicker, filteredEvents);
                    }
                },
                plotLines: visibleEvents.map(event => ({
                    id: `tweet-line-${event.id}`,
                    value: event.date.getTime(),
                    color: event.markerColor,
                    width: 1,
                    dashStyle: 'ShortDash',
                    zIndex: 4,
                    label: {
                        text: event.markerTitle,
                        rotation: 0,
                        y: 12,
                        style: {
                            color: event.markerColor,
                            fontWeight: '700',
                            fontSize: '10px'
                        }
                    }
                }))
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
                        title: meta.title,
                        text: `${meta.label} tweet<br>${this.escapeHtml(event.text)}<br>Post move: ${event.reaction.label}`
                    }));

                return {
                    type: 'flags',
                    name: `${meta.label} tweets`,
                    data,
                    onSeries: onSeriesId,
                    fillColor: meta.color,
                    color: meta.color,
                    lineColor: meta.color
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
            const span = this.currentWindowMs || (axis.max - axis.min);
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

            const card = document.createElement('div');
            card.className = `tweet-card ${sentimentClass}`;
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
                        <span class="label">Tweet Marker</span>
                        <span class="val" style="color: ${event.markerColor}">${event.markerTitle}</span>
                    </div>
                    <div class="tweet-card-metric">
                        <span class="label">Post Move</span>
                        <span class="val ${reactionClass}">${event.reaction.label}</span>
                    </div>
                </div>
            `;

            card.addEventListener('click', () => {
                document.querySelectorAll('.tweet-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                this.panToDate(event.date);
            });

            container.appendChild(card);
        });

        if (window.lucide) {
            lucide.createIcons();
        }
    }

    filterEventsByTopic(topicName) {
        const topic = TOPIC_DEFINITIONS[topicName];
        if (!topic || !this.currentEvents) return;

        const keywords = topic.keywords;
        const filteredEvents = this.currentEvents.filter(event => {
            const content = event.text.toLowerCase();
            return keywords.some(keyword => content.includes(keyword));
        });

        const displayTicker = this.displayTickerLabel(this.currentTicker);
        const subtitle = document.getElementById('tweet-stream-subtitle');
        if (subtitle) {
            subtitle.innerHTML = `<span style="color: ${topic.color}; font-weight: 700;">${topicName}</span>: ${filteredEvents.length} posts found in the ${displayTicker} range.`;
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
}

document.addEventListener('DOMContentLoaded', async () => {
    window.reflexChart = new ReflexChart('candlestick-chart');

    const stockSelector = document.getElementById('stock-selector');
    const engineSelector = document.getElementById('chart-engine-selector');

    await window.reflexChart.update(stockSelector?.value || 'SPY', engineSelector?.value || 'scichart');

    if (stockSelector) {
        stockSelector.addEventListener('change', event => {
            window.reflexChart.update(event.target.value, engineSelector?.value || window.reflexChart.chartEngine);
        });
    }

    if (engineSelector) {
        engineSelector.addEventListener('change', event => {
            window.reflexChart.setChartEngine(event.target.value);
        });
    }

    const yearSelector = document.getElementById('year-selector');
    if (yearSelector) {
        yearSelector.addEventListener('change', event => {
            window.reflexChart.update(window.reflexChart.currentTicker, window.reflexChart.chartEngine, event.target.value);
        });
    }

    window.addEventListener('resize', () => {
        window.reflexChart.reflowActiveChart();
    });
});
