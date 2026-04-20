document.addEventListener("DOMContentLoaded", () => {
    fetch('word_cloud_data.json')
        .then(response => response.json())
        .then(data => {
            // Filter out junk or cap it
            const limitedData = data.slice(0, 100);

            const container = document.getElementById('word-cloud-container');
            const width = container.clientWidth;
            const height = container.clientHeight || 500; // Provide default if container height fails early

            // Prepare max size scale
            const sizeScale = d3.scaleLinear()
                .domain([d3.min(limitedData, d => d.size), d3.max(limitedData, d => d.size)])
                .range([16, 80]);

            const layout = d3.layout.cloud()
                .size([width, height])
                .words(limitedData.map(d => ({
                    text: d.text.toLowerCase(),
                    size: sizeScale(d.size),
                    originalData: d
                })))
                .padding(5)
                .rotate(() => 0) // No rotation for cleaner "fintech" readability
                .font("Instrument Serif")
                .fontSize(d => d.size)
                .on("end", draw);

            layout.start();

            function draw(words) {
                const svg = d3.select("#word-cloud-container").append("svg")
                    .attr("width", width)
                    .attr("height", height)
                    .append("g")
                    .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

                // Tooltip for word cloud
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

                svg.selectAll("text")
                    .data(words)
                    .enter().append("text")
                    .style("font-family", "Instrument Serif")
                    .style("font-style", "italic")
                    .style("font-size", d => Math.max(10, d.size) + "px")
                    .style("fill", "var(--ink)")
                    .attr("class", "word-cloud-item")
                    .attr("text-anchor", "middle")
                    .attr("transform", d => "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")")
                    .text(d => d.text)
                    .on("mouseover", function(event, d) {
                        d3.select(this)
                            .style("fill", "var(--success-green)");
                            
                        tooltip.transition().duration(200).style("opacity", 1);
                        tooltip.html(`
                            <div style="font-weight: 600; text-transform: uppercase; color: var(--zinc-600); font-size: 10px; margin-bottom: 4px;">Sector Category: ${d.originalData.category}</div>
                            <div style="font-size: 14px; margin-bottom: 4px;">Pivots to: <strong>${d.originalData.related_stock}</strong></div>
                            <div style="font-size: 11px; color: var(--zinc-600);">Frequency in Dataset: ${d.originalData.size.toLocaleString()} times</div>
                        `)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 28) + "px");
                    })
                    .on("mouseout", function(event, d) {
                        if (d3.select(this).attr("data-active") !== "true") {
                            d3.select(this).style("fill", "var(--ink)");
                        }
                        tooltip.transition().duration(500).style("opacity", 0);
                    })
                    .on("click", function(event, d) {
                        // Trigger ReflexChart update
                        if (window.reflexChart && d.originalData.related_stock) {
                            window.reflexChart.update(d.originalData.related_stock);
                            
                            // Visual feedback
                            svg.selectAll("text")
                                .style("opacity", 0.2)
                                .style("fill", "var(--ink)")
                                .attr("data-active", "false");
                                
                            d3.select(this)
                                .style("opacity", 1)
                                .style("fill", "var(--success-green)")
                                .attr("data-active", "true");
                        }
                    });
            }
        });
});
