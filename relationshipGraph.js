/**
 * Relationship Graph Component (Node-Link)
 * Shows correlation between keywords, tweets, and their market volume impact.
 */

class RelationshipGraph {
    constructor(containerId) {
        this.containerId = containerId;
        this.svg = null;
        this.simulation = null;
        this.tooltip = this.initTooltip();
    }

    initTooltip() {
        return d3.select("body").append("div")
            .attr("class", "graph-tooltip")
            .style("opacity", 0);
    }

    render(data, metric = 'impact') {
        this.currentMetric = metric;
        const container = document.getElementById(this.containerId);
        if (!container) return;

        // Clear previous
        d3.select(`#${this.containerId} svg`).remove();

        const width = container.clientWidth;
        const height = container.clientHeight;

        this.svg = d3.select(`#${this.containerId}`)
            .append("svg")
            .attr("width", width)
            .attr("height", height)
            .append("g");

        // Zoom support
        const zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on("zoom", (event) => {
                this.svg.attr("transform", event.transform);
            });

        d3.select(`#${this.containerId} svg`).call(zoom);

        const { nodes, links } = data;

        this.simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links).id(d => d.id).distance(100))
            .force("charge", d3.forceManyBody().strength(-200))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collision", d3.forceCollide().radius(d => (d.size || 10) + 10));

        const link = this.svg.append("g")
            .attr("class", "links")
            .selectAll("line")
            .data(links)
            .enter().append("line")
            .attr("class", "graph-link")
            .attr("stroke-width", d => Math.sqrt(d.value || 1));

        const node = this.svg.append("g")
            .attr("class", "nodes")
            .selectAll("g")
            .data(nodes)
            .enter().append("g")
            .attr("class", d => `graph-node node-${d.type}`)
            .call(this.drag(this.simulation));

        // Scale for word node opacity
        const wordNodes = nodes.filter(n => n.type === 'word');
        const metricKey = this.currentMetric === 'impact' ? 'impactScore' : 'count';
        const minVal = d3.min(wordNodes, n => n[metricKey]) || 1;
        const maxVal = d3.max(wordNodes, n => n[metricKey]) || 10;
        
        const opacityScale = d3.scaleLinear()
            .domain([minVal, maxVal])
            .range([0.2, 0.9]);

        // Add Tweet nodes (Squares)
        node.filter(d => d.type === 'tweet')
            .append("rect")
            .attr("width", d => (d.size || 10) * 2)
            .attr("height", d => (d.size || 10) * 2)
            .attr("x", d => -(d.size || 10))
            .attr("y", d => -(d.size || 10))
            .attr("rx", 4) // Slightly rounded corners
            .attr("fill", d => this.getSentimentColor(d.sentiment));

        // Add Word nodes (Circles)
        node.filter(d => d.type === 'word')
            .append("circle")
            .attr("r", d => d.size || 10)
            .attr("fill", "#000000")
            .attr("fill-opacity", d => opacityScale(d[metricKey]));

        node.append("text")
            .attr("class", "graph-label")
            .attr("dy", d => (d.size || 10) + 12)
            .attr("text-anchor", "middle")
            .text(d => d.label || d.id);

        node.on("mouseover", (event, d) => {
            this.tooltip.transition().duration(200).style("opacity", .9);
            this.tooltip.html(this.getTooltipHtml(d))
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", () => {
            this.tooltip.transition().duration(500).style("opacity", 0);
        })
        .on("click", (event, d) => {
            if (d.type === 'word' && window.reflexChart) {
                window.reflexChart.filterEventsByKeyword(d.id);
            } else if (d.type === 'tweet' && window.reflexChart) {
                window.reflexChart.scrollToTweet(d.id);
            }
        });

        this.simulation.on("tick", () => {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            node
                .attr("transform", d => `translate(${d.x},${d.y})`);
        });
    }

    getSentimentColor(sentiment) {
        const colors = {
            'positive': '#10B981',
            'negative': '#E11D48',
            'neutral': '#52525B'
        };
        return colors[sentiment] || '#52525B';
    }

    getTooltipHtml(d) {
        if (d.type === 'tweet') {
            return `
                <div style="font-weight: 700; color: var(--ink); margin-bottom: 4px;">TWEET CATALYST</div>
                <div style="margin-bottom: 8px; line-height: 1.4;">${d.fullText}</div>
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--zinc-600);">
                    <span>Impact: <span style="color: var(--ink); font-weight: 700;">${d.impactScore.toFixed(2)}x Volume</span></span>
                </div>
            `;
        }
        return `
            <div style="font-weight: 700; color: var(--ink); margin-bottom: 4px;">KEYWORD: ${d.id.toUpperCase()}</div>
            <div style="font-size: 11px; color: var(--zinc-600);">Appears in ${d.count} impactful tweets</div>
        `;
    }

    drag(simulation) {
        function dragstarted(event) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }
        
        function dragged(event) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }
        
        function dragended(event) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }
        
        return d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);
    }
}
