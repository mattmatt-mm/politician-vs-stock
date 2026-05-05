/**
 * Word Cloud Component
 * Handles both Keyword Mode (Stock pivoting) and Topic Mode (Stream filtering)
 */

document.addEventListener("DOMContentLoaded", () => {
    let currentMode = 'keywords';
    let keywordData = null;
    let stocksData = null;
    let termFreqData = null;
    const container = document.getElementById('word-cloud-container');
    const modeSelector = document.getElementById('cloud-mode-selector');
    
    // Create Tooltip once
    const tooltip = d3.select("body").append("div")
        .attr("class", "cloud-tooltip")
        .style("position", "absolute")
        .style("opacity", 0)
        .style("pointer-events", "none")
        .style("z-index", "100")
        .style("padding", "12px")
        .style("background", "white")
        .style("border", "1px solid var(--zinc-200)")
        .style("font-family", "Inter")
        .style("font-size", "12px")
        .style("box-shadow", "0 10px 15px -3px rgba(0, 0, 0, 0.1)");

    function initCloud() {
        // Keyword entries come from window.updateKeywordCloud (ReflexChart: same event set as term frequency).

        fetch('/api/stock-mentions')
            .then(response => response.json())
            .then(data => {
                stocksData = data;
                if (currentMode === 'stocks') renderCloud();
            })
            .catch(err => console.warn('Could not fetch stock mentions:', err));

        fetch('/api/term-frequency')
            .then(response => response.json())
            .then(data => {
                termFreqData = data;
                if (currentMode === 'terms-bar') renderBarChart();
            })
            .catch(err => console.warn('Could not fetch term frequency:', err));
    }

    /** Highcharts leaves wrapper divs on #word-cloud-container; removing only svg breaks layout when switching modes. */
    function destroyCloudHighcharts() {
        if (typeof Highcharts === 'undefined') return;
        const idx = Highcharts.charts.findIndex(
            c => c && c.renderTo && c.renderTo.id === 'word-cloud-container'
        );
        if (idx !== -1 && Highcharts.charts[idx]) {
            Highcharts.charts[idx].destroy();
        }
    }

    function renderCloud() {
        if (currentMode === 'terms-bar') {
            renderBarChart();
            return;
        }

        destroyCloudHighcharts();
        if (container) container.innerHTML = '';

        if (currentMode === 'keywords' && keywordData === null) {
            if (container) {
                container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--zinc-500);">Loading keywords…</div>';
            }
            return;
        }
        if (currentMode === 'keywords' && keywordData.length === 0) {
            if (container) {
                container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--zinc-500);">No keywords in the current chart range.</div>';
            }
            return;
        }
        if (currentMode === 'stocks' && (!stocksData || stocksData.length === 0)) return;

        // Clear previous SVG (redundant after innerHTML clear; kept for safety if container logic changes)
        d3.select("#word-cloud-container svg").remove();
        
        const width = container.clientWidth;
        const height = container.clientHeight || 400;
        
        let words = [];
        
        if (currentMode === 'keywords') {
            const minS = d3.min(keywordData, d => d.size);
            const maxS = d3.max(keywordData, d => d.size);
            const lo = minS === maxS ? minS - 1 : minS;
            const hi = minS === maxS ? maxS + 1 : maxS;
            const sizeScale = d3.scaleLinear()
                .domain([lo, hi])
                .range([16, 80]);
                
            words = keywordData.map(d => ({
                text: d.text.toLowerCase(),
                size: sizeScale(d.size),
                originalData: d,
                type: 'keyword'
            }));
        } else if (currentMode === 'stocks') {
            const data = stocksData || [];
            const minZ = d3.min(data, d => d.size) || 0;
            const maxZ = d3.max(data, d => d.size) || 1;
            const z0 = minZ === maxZ ? minZ - 1 : minZ;
            const z1 = minZ === maxZ ? maxZ + 1 : maxZ;
            const sizeScale = d3.scaleLinear()
                .domain([z0, z1])
                .range([24, 90]);
                
            words = data.map(d => ({
                text: d.text,
                size: sizeScale(d.size),
                originalData: d,
                type: 'keyword'
            }));
        } else if (currentMode === 'topics') {
            const topics = window.TOPIC_DEFINITIONS;
            if (!topics || Object.keys(topics).length === 0) {
                words = [{ text: "Loading Topics...", size: 30, type: 'status' }];
            } else {
                words = Object.keys(topics).map(topicName => ({
                    text: topicName,
                    size: 44,
                    color: topics[topicName].color,
                    type: 'topic'
                }));
            }
        }

        const layout = d3.layout.cloud()
            .size([width, height])
            .words(words)
            .padding(10)
            .rotate(() => 0)
            .font("'Instrument Serif', serif")
            .fontSize(d => d.size)
            .on("end", (drawWords) => draw(drawWords, width, height));

        layout.start();
    }

    function draw(words, width, height) {
        const svg = d3.select("#word-cloud-container").append("svg")
            .attr("width", width)
            .attr("height", height)
            .append("g")
            .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

        svg.selectAll("text")
            .data(words)
            .enter().append("text")
            .style("font-family", "Instrument Serif")
            .style("font-style", "italic")
            .style("font-size", d => Math.max(10, d.size) + "px")
            .style("fill", d => d.type === 'topic' ? d.color : "var(--ink)")
            .style("cursor", "pointer")
            .attr("class", "word-cloud-item")
            .attr("text-anchor", "middle")
            .attr("transform", d => "translate(" + [d.x, d.y] + ")")
            .text(d => d.text)
            .on("mouseover", function(event, d) {
                d3.select(this).style("opacity", 0.7);
                
                tooltip.transition().duration(200).style("opacity", 1);
                
                if (d.type === 'keyword') {
                    tooltip.html(`
                        <div style="font-weight: 600; text-transform: uppercase; color: var(--zinc-600); font-size: 10px; margin-bottom: 4px;">Sector Category: ${d.originalData.category}</div>
                        <div style="font-size: 14px; margin-bottom: 4px;">Pivots to: <strong>${d.originalData.related_stock}</strong></div>
                        <div style="font-size: 11px; color: var(--zinc-600);">Frequency in Dataset: ${d.originalData.size.toLocaleString()} times</div>
                    `);
                } else {
                    tooltip.html(`
                        <div style="font-weight: 600; text-transform: uppercase; color: var(--zinc-600); font-size: 10px; margin-bottom: 4px;">Filtering Mode</div>
                        <div style="font-size: 14px; margin-bottom: 4px; color: ${d.color}">Topic: <strong>${d.text}</strong></div>
                        <div style="font-size: 11px; color: var(--zinc-600);">Applies topical keyword filter to current view.</div>
                    `);
                }
                
                tooltip.style("left", (event.pageX + 10) + "px")
                       .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
                d3.select(this).style("opacity", 1);
                tooltip.transition().duration(500).style("opacity", 0);
            })
            .on("click", function(event, d) {
                if (d.type === 'keyword') {
                    if (window.reflexChart) {
                        const isStockMode = d.originalData.category === 'Stock';
                        const ticker = d.originalData.related_stock;
                        
                        // If it's a direct stock mention in Stock mode, pivot.
                        // Otherwise, filter the current view.
                        if (isStockMode && ticker && ticker !== 'SPY') {
                            if (window.selectTickerUI) {
                                window.selectTickerUI(ticker);
                            } else {
                                window.reflexChart.update(ticker);
                            }
                        } else {
                            window.reflexChart.filterEventsByKeyword(d.text);
                        }
                        
                        svg.selectAll("text").style("opacity", 0.4);
                        d3.select(this).style("opacity", 1);
                    }
                } else {
                    // Topic Click
                    if (window.reflexChart) {
                        // Reset to S&P 500 if not already in index mode, or just filter
                        // For simplicity, let's just filter the current view as suggested
                        window.reflexChart.filterEventsByTopic(d.text);
                        
                        svg.selectAll("text")
                            .style("opacity", 0.4)
                            .style("stroke", "none");
                            
                        d3.select(this)
                            .style("opacity", 1)
                            .style("stroke", d.color)
                            .style("stroke-width", "1px");
                    }
                }
            });
    }

    function renderBarChart() {
        destroyCloudHighcharts();
        if (container) container.innerHTML = '';

        if (!termFreqData || Object.keys(termFreqData).length === 0) {
            container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--zinc-500);">No term frequency data available. Run compute_term_frequency.py first.</div>';
            return;
        }

        // Sort by frequency descending
        const sortedWords = Object.entries(termFreqData)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20);

        Highcharts.chart('word-cloud-container', {
            chart: {
                type: 'bar',
                height: container.clientHeight || 400,
                backgroundColor: 'transparent'
            },
            title: { text: null },
            xAxis: {
                categories: sortedWords.map(w => w[0]),
                title: { text: null },
                labels: {
                    style: {
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '11px',
                        color: 'var(--zinc-700)'
                    }
                }
            },
            yAxis: {
                min: 0,
                title: {
                    text: 'Frequency',
                    style: { fontFamily: 'Inter, sans-serif', fontSize: '11px' }
                },
                labels: {
                    style: { fontFamily: 'Inter, sans-serif', fontSize: '10px' }
                }
            },
            legend: { enabled: false },
            credits: { enabled: false },
            tooltip: {
                formatter: function() {
                    return `<b>${this.x}</b>: ${this.y.toLocaleString()} occurrences`;
                }
            },
            plotOptions: {
                bar: {
                    dataLabels: {
                        enabled: true,
                        style: { fontFamily: 'Inter, sans-serif', fontSize: '10px', fontWeight: '400' }
                    },
                    color: '#10B981',
                    borderRadius: 2,
                    cursor: 'pointer',
                    point: {
                        events: {
                            click: function() {
                                if (window.reflexChart) {
                                    window.reflexChart.filterEventsByKeyword(this.category);
                                }
                            }
                        }
                    }
                }
            },
            series: [{
                name: 'Frequency',
                data: sortedWords.map(w => w[1])
            }]
        });
    }

    if (modeSelector) {
        modeSelector.addEventListener('change', (e) => {
            currentMode = e.target.value;
            renderCloud();
        });
    }

    window.addEventListener('resize', () => {
        if (keywordData !== null || stocksData || termFreqData) renderCloud();
    });

    window.resetWordCloud = function() {
        currentMode = 'keywords';
        if (modeSelector) modeSelector.value = 'keywords';
        renderCloud();
    };

    window.updateTermFrequency = function(freqData) {
        termFreqData = freqData;
        if (currentMode === 'terms-bar') {
            renderBarChart();
        }
    };

    window.updateKeywordCloud = function(rows) {
        keywordData = Array.isArray(rows) ? rows : [];
        if (currentMode === 'keywords') {
            renderCloud();
        }
    };

    window.updateWordCloud = function() {
        if (currentMode === 'topics') {
            renderCloud();
        }
    };

    initCloud();
});
