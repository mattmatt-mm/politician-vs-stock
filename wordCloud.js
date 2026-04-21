/**
 * Word Cloud Component
 * Handles both Keyword Mode (Stock pivoting) and Topic Mode (Stream filtering)
 */

document.addEventListener("DOMContentLoaded", () => {
    let currentMode = 'keywords';
    let keywordData = null;
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
        fetch('word_cloud_data.json')
            .then(response => response.json())
            .then(data => {
                keywordData = data.slice(0, 100);
                renderCloud();
            });
    }

    function renderCloud() {
        // Clear previous SVG
        d3.select("#word-cloud-container svg").remove();
        
        const width = container.clientWidth;
        const height = container.clientHeight || 400;
        
        let words = [];
        
        if (currentMode === 'keywords') {
            const sizeScale = d3.scaleLinear()
                .domain([d3.min(keywordData, d => d.size), d3.max(keywordData, d => d.size)])
                .range([16, 80]);
                
            words = keywordData.map(d => ({
                text: d.text.toLowerCase(),
                size: sizeScale(d.size),
                originalData: d,
                type: 'keyword'
            }));
        } else {
            // Topic Mode: Predefined topics from script.js constants if available, or locally
            const topics = window.TOPIC_DEFINITIONS || {
                'War & Defense': { keywords: ['war'], color: '#E11D48' },
                'Tariffs & Trade': { keywords: ['tariff'], color: '#D97706' },
                'Tech & AI': { keywords: ['ai'], color: '#2563EB' },
                'Immigration': { keywords: ['border'], color: '#059669' },
                'Politics': { keywords: ['biden'], color: '#7C3AED' }
            };
            
            words = Object.keys(topics).map(topicName => ({
                text: topicName,
                size: 48, // Fixed large size for topics
                color: topics[topicName].color,
                type: 'topic'
            }));
        }

        const layout = d3.layout.cloud()
            .size([width, height])
            .words(words)
            .padding(10)
            .rotate(() => 0)
            .font("Instrument Serif")
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
                    if (window.reflexChart && d.originalData.related_stock) {
                        window.reflexChart.update(d.originalData.related_stock);
                        // Visual feedback handled by reflexChart update? 
                        // Actually let's keep the feedback here too
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

    if (modeSelector) {
        modeSelector.addEventListener('change', (e) => {
            currentMode = e.target.value;
            renderCloud();
        });
    }

    window.addEventListener('resize', () => {
        if (keywordData) renderCloud();
    });

    initCloud();
});
