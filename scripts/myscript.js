console.log("Initializing script...");

// Set up canvas dimensions
const width = 800;
const height = 600;

// Create the SVG container
const svg = d3.select("#plot")
  .append("svg")
  .attr("width", width)
  .attr("height", height)
  .style("border", "1px solid #ccc");

// Create a group for the map (to support zoom/pan)
const g = svg.append("g");

// Projection and path generator for NYC boroughs
const projection = d3.geoMercator()
  .center([-74.006, 40.7128]) // NYC center
  .scale(30000) // Adjusted scale for full NYC visibility
  .translate([width / 2, height / 2]);

const path = d3.geoPath().projection(projection);

// Tooltip div
const tooltip = d3.select("body").append("div")
  .attr("class", "tooltip")
  .style("opacity", 0)
  .style("position", "absolute")
  .style("background", "#fff")
  .style("border", "1px solid #ccc")
  .style("padding", "10px")
  .style("border-radius", "5px")
  .style("pointer-events", "none");

// Add dropdown for borough filter
d3.select("#plot").append("select")
  .attr("id", "borough-filter")
  .style("margin", "10px")
  .style("padding", "5px")
  .style("font-size", "14px")
  .html(`
    <option value="All">All Boroughs</option>
    <option value="Manhattan">Manhattan</option>
    <option value="Brooklyn">Brooklyn</option>
    <option value="Queens">Queens</option>
    <option value="Bronx">Bronx</option>
    <option value="Staten Island">Staten Island</option>
  `);

// Add buttons for zoom reset and map download
d3.select("#plot").append("button")
  .attr("id", "reset-zoom")
  .text("Reset Zoom")
  .style("margin", "10px")
  .style("padding", "5px")
  .style("font-size", "14px");

d3.select("#plot").append("button")
  .attr("id", "download-map")
  .text("Download Map")
  .style("margin", "10px")
  .style("padding", "5px")
  .style("font-size", "14px");

// Load NYC Borough Boundaries
console.log("Loading NYC borough boundaries...");

d3.json("https://raw.githubusercontent.com/dwillis/nyc-maps/master/boroughs.geojson").then(boroughData => {
  console.log("NYC borough boundaries loaded successfully.");

  // Draw the boroughs on the map
  g.selectAll("path")
    .data(boroughData.features)
    .enter().append("path")
    .attr("d", path)
    .attr("fill", "#ecf0f1")
    .attr("stroke", "#2c3e50")
    .attr("stroke-width", 1)
    .on("mouseover", function () {
      d3.select(this).attr("fill", "#bdc3c7"); // Highlight borough on hover
    })
    .on("mouseout", function () {
      d3.select(this).attr("fill", "#ecf0f1"); // Reset color on mouseout
    });

  // Load Tree Data (local CSV file)
  console.log("Loading tree data from data_files/2015_Street_Tree_Census_-_Tree_Data_20241120.csv...");

  d3.csv("data_files/2015_Street_Tree_Census_-_Tree_Data_20241120.csv").then(treeData => {
    console.log("Tree data loaded successfully. Total rows loaded: ", treeData.length);

    // Randomly sample 1000 rows from the data and filter valid rows
    const sampleSize = 1000;
    const trees = d3.shuffle(treeData)
      .slice(0, sampleSize)
      .filter(d => d.latitude && d.longitude && d.health)
      .map(d => ({
        latitude: +d.latitude,
        longitude: +d.longitude,
        health: d.health,
        species: d.spc_common,
        dbh: +d.tree_dbh || 0,
        borough: d.borough
      }));

    console.log("Tree data processed successfully. Total trees ready for visualization: ", trees.length);

    // Summary Statistics
    const healthSummary = d3.rollup(
      trees, 
      v => v.length, 
      d => d.health
    );

    d3.select("#plot").append("div")
      .attr("class", "summary")
      .style("position", "absolute")
      .style("bottom", "10px")
      .style("left", "10px")
      .style("background", "#fff")
      .style("padding", "10px")
      .style("border", "1px solid #ccc")
      .style("border-radius", "5px")
      .html(`
        <strong>Tree Summary</strong><br>
        Total Trees: ${trees.length}<br>
        Good: ${healthSummary.get("Good") || 0}<br>
        Fair: ${healthSummary.get("Fair") || 0}<br>
        Poor: ${healthSummary.get("Poor") || 0}<br>
        Unknown: ${healthSummary.get(undefined) || 0}
      `);

    // Draw each tree as a circle on the map
    const drawTrees = (filteredTrees) => {
      const circles = g.selectAll("circle").data(filteredTrees, d => d.latitude + d.longitude);

      circles.enter()
        .append("circle")
        .attr("cx", d => projection([d.longitude, d.latitude])[0])
        .attr("cy", d => projection([d.longitude, d.latitude])[1])
        .attr("r", 0) // Start with zero radius
        .attr("fill", d => d.health === "Good" ? "#27ae60" : 
                          d.health === "Fair" ? "#f1c40f" : 
                          d.health === "Poor" ? "#e74c3c" : "#bdc3c7")
        .attr("opacity", 0.8)
        .on("mouseover", function (event, d) {
          tooltip.transition().duration(200).style("opacity", 1);
          tooltip.html(`
            <strong>Species:</strong> ${d.species || "Unknown"}<br>
            <strong>Health:</strong> ${d.health || "Unknown"}<br>
            <strong>DBH:</strong> ${d.dbh || "N/A"}<br>
            <strong>Borough:</strong> ${d.borough || "Unknown"}
          `)
          .style("left", `${event.pageX + 10}px`)
          .style("top", `${event.pageY + 10}px`);
        })
        .on("mouseout", function () {
          tooltip.transition().duration(200).style("opacity", 0);
        })
        .transition().duration(500)
        .attr("r", d => Math.sqrt(d.dbh) / 2 + 2); // Smooth animation

      circles.exit().remove();
    };

    drawTrees(trees);

    // Filter trees by borough
    d3.select("#borough-filter").on("change", function () {
      const selectedBorough = this.value;
      const filteredTrees = selectedBorough === "All" ? trees : trees.filter(d => d.borough === selectedBorough);
      drawTrees(filteredTrees);
    });

    console.log("Tree visualization complete.");

    // Add Legend
    const legend = svg.append("g")
      .attr("transform", `translate(${width - 150}, 50)`);

    const legendData = [
      { color: "#27ae60", label: "Good Health" },
      { color: "#f1c40f", label: "Fair Health" },
      { color: "#e74c3c", label: "Poor Health" },
      { color: "#bdc3c7", label: "Data Not Available" }
    ];

    legend.selectAll("rect")
      .data(legendData)
      .enter().append("rect")
      .attr("x", 0)
      .attr("y", (d, i) => i * 25)
      .attr("width", 20)
      .attr("height", 20)
      .attr("fill", d => d.color);

    legend.selectAll("text")
      .data(legendData)
      .enter().append("text")
      .attr("x", 30)
      .attr("y", (d, i) => i * 25 + 15)
      .text(d => d.label)
      .style("font-size", "12px")
      .style("fill", "#333");

    console.log("Legend added successfully.");
  }).catch(error => {
    console.error("Error loading tree data: ", error);
  });

}).catch(error => {
  console.error("Error loading borough data: ", error);
});

// Add zoom and pan functionality
console.log("Initializing zoom and pan functionality...");

const zoom = d3.zoom()
  .scaleExtent([1, 8]) // Limit zoom level
  .on('zoom', (event) => {
    g.attr('transform', event.transform);
  });

svg.call(zoom);

d3.select("#reset-zoom").on("click", function() {
  svg.transition()
    .duration(750)
    .call(zoom.transform, d3.zoomIdentity); // Reset zoom to initial state
});

d3.select("#download-map").on("click", function() {
  const svgElement = document.querySelector("svg");
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgElement);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = width;
  canvas.height = height;

  const img = new Image();
  img.onload = function () {
    ctx.drawImage(img, 0, 0);
    const a = document.createElement("a");
    a.download = "tree_map.png";
    a.href = canvas.toDataURL("image/png");
    a.click();
  };
  img.src = "data:image/svg+xml;base64," + btoa(svgString);
});

console.log("Zoom, pan, and download functionality ready.");
