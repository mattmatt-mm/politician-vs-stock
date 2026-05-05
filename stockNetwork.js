/**
 * Stock Network Component
 * Visualizes relationships between stocks based on sector, topics, and correlation.
 */

class StockNetwork {
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

    render(data) {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        d3.select(`#${this.containerId} svg`).remove();

        const width = container.clientWidth;
        const height = container.clientHeight;

        const mainSvg = d3.select(`#${this.containerId}`)
            .append("svg")
            .attr("width", width)
            .attr("height", height);
            
        this.svg = mainSvg.append("g");

        const zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on("zoom", (event) => {
                this.svg.attr("transform", event.transform);
            });

        mainSvg.call(zoom);

        const { nodes, links } = data;

        this.simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links).id(d => d.id).distance(150))
            .force("charge", d3.forceManyBody().strength(-300))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collision", d3.forceCollide().radius(40));

        const link = this.svg.append("g")
            .attr("class", "links")
            .selectAll("line")
            .data(links)
            .enter().append("line")
            .attr("class", "graph-link")
            .attr("stroke-width", 2)
            .attr("stroke", "#E4E4E7");

        const node = this.svg.append("g")
            .attr("class", "nodes")
            .selectAll("g")
            .data(nodes)
            .enter().append("g")
            .attr("class", d => `graph-node ${d.isCenter ? 'node-center' : ''}`)
            .call(this.drag(this.simulation));

        node.append("circle")
            .attr("r", d => d.isCenter ? 35 : 25)
            .attr("fill", d => d.isCenter ? '#000000' : '#FFFFFF')
            .attr("stroke", d => d.isCenter ? '#000000' : '#E4E4E7')
            .attr("stroke-width", 2);

        node.append("text")
            .attr("dy", 4)
            .attr("text-anchor", "middle")
            .style("font-family", "Inter")
            .style("font-weight", "700")
            .style("font-size", d => d.isCenter ? "12px" : "10px")
            .style("fill", d => d.isCenter ? "#FFFFFF" : "#000000")
            .text(d => d.id);

        node.on("mouseover", (event, d) => {
            this.tooltip.transition().duration(200).style("opacity", .9);
            this.tooltip.html(this.getTooltipHtml(d, links))
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
                
            // Highlight connections
            link.style("stroke", l => (l.source.id === d.id || l.target.id === d.id) ? '#000000' : '#E4E4E7')
                .style("stroke-opacity", l => (l.source.id === d.id || l.target.id === d.id) ? 1 : 0.2);
        })
        .on("mouseout", () => {
            this.tooltip.transition().duration(500).style("opacity", 0);
            link.style("stroke", "#E4E4E7").style("stroke-opacity", 0.6);
        })
        .on("click", (event, d) => {
            if (window.selectTickerUI) {
                window.selectTickerUI(d.id);
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

    getTooltipHtml(d, allLinks) {
        if (d.isCenter) {
            return `
                <div style="font-weight: 700; color: var(--ink); margin-bottom: 4px;">SELECTED STOCK: ${d.id}</div>
                <div style="font-size: 11px; color: var(--zinc-600);">Center of analysis. Connected to related companies via sector and topic overlap.</div>
            `;
        }
        
        const link = allLinks.find(l => (l.source.id === d.id || l.target.id === d.id) && (l.source.isCenter || l.target.isCenter));
        const reason = link ? link.reason : "Related via market sector";

        return `
            <div style="font-weight: 700; color: var(--ink); margin-bottom: 4px;">RELATIONSHIP: ${d.id}</div>
            <div style="font-size: 12px; margin-bottom: 4px; color: var(--zinc-800);">${reason}</div>
            <div style="font-size: 11px; color: var(--zinc-600);">Click to pivot dashboard to this ticker.</div>
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
        return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
    }
}
