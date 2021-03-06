/**
 * Created by salasd1 on 11/24/2014.
 */
'use strict';
var $ = require('jquery');
var d3 = require('d3');
var cola = require('cola');
var Promise = require('bluebird');
var Graph = require('./graph.js');
var StringUtils = new (require('./string_utils.js'));

module.exports = {
  initializeNewGraph: function(rootArticle) {
    d3.select("svg").remove();
    new WikiGraph(rootArticle);
  }
};

function WikiGraph(rootArticle)
{
    var width = 960;
    var height = 500;

    var red = "rgb(254, 137, 137)";

    var d3cola = cola.d3adaptor()
      .linkDistance(60)
      .size([width, height]);

    var outer = d3.select("#chart").append("svg")
      .attr("viewBox", "0 0 " + width + " " + height )
      .attr("preserveAspectRatio", "xMinYMin")
      .attr("pointer-events", "all");

    //Set up tooltip
    var tip = d3.tip()
      .attr('class', 'd3-tip')
      .offset([-10, 0])
      .html(function (d) {
        return d.title + "</span>";
      })
    outer.call(tip);

    var zoom = d3.behavior.zoom();

    outer.append('rect')
      .attr('class', 'background')
      .attr('width', "100%")
      .attr('height', "100%")
      .call(zoom.on("zoom", redraw))
      .on("dblclick.zoom", zoomToFit);

    var defs = outer.append("svg:defs");

    function addGradient(id, color1, opacity1, color2, opacity2) {
      var gradient = defs.append("svg:linearGradient")
        .attr("id", id)
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "0%")
        .attr("spreadMethod", "pad");

      gradient.append("svg:stop")
        .attr("offset", "0%")
        .attr("stop-color", color1)
        .attr("stop-opacity", opacity1);

      gradient.append("svg:stop")
        .attr("offset", "100%")
        .attr("stop-color", color2)
        .attr("stop-opacity", opacity2);
    }
    addGradient("SpikeGradient", "red", 1, "red", 0);
    addGradient("EdgeGradient", red, 1, "darkgray", 1);
    addGradient("ReverseEdgeGradient", "darkgray", 1, red, 1);
    var vis = outer.append('g');
    var edgesLayer = vis.append("g");
    var nodesLayer = vis.append("g");
    var nodeMouseDown = false;

    function redraw(transition) {
      // if mouse down then we are dragging not panning
      if (nodeMouseDown) return;
      (transition ? vis.transition() : vis)
        .attr("transform", "translate(" + zoom.translate() + ") scale(" + zoom.scale() + ")");
    }

    var modelgraph = new Graph();
    var viewgraph = { nodes: [], links: [] };
    var nodeWidth = 30, nodeHeight = 35;
    // get first node
    var d = modelgraph.getNode(rootArticle.value, addViewNode);
    d.then(function (startNode) {
      refocus(startNode);
      $('.img-thumbnail').css({
        'display' : '',
        'visibility' : 'visible'
      });
      populateArticleSummary(startNode);
    });

    function refocus(focus) {
      var neighboursExpanded = modelgraph.expandNeighbours(focus, function (v) {
        if (!inView(v)){
          addViewNode(v, focus);
        }
      });
      refreshViewGraph();
      loadImage(focus);
      neighboursExpanded.then(function (neighbors) {
        refreshViewGraph();
        neighbors.map(function (node) {
          loadImage(node);
        });
      });
    }

    function refreshViewGraph() {
      viewgraph.links = [];
      viewgraph.nodes.forEach(function (v) {
        var fullyExpanded = modelgraph.isFullyExpanded(v);
        v.color = fullyExpanded ? "darkgrey" : red;
        if (!v.links) return;
      });

      Object.keys(modelgraph.edges).forEach(function (e) {
        var l = modelgraph.edges[e];
        var u = modelgraph.nodes[l.source];
        var v = modelgraph.nodes[l.target];

        if (inView(u) && inView(v)) {
          viewgraph.links.push({ source: u, target: v });
        }

        if (inView(u) && !inView(v)) {
          u.color = red;
        }

        if (!inView(u) && inView(v)){
          v.color = red;
        }
      });
      update();
    }

    function inView(v) {
      return typeof v.viewgraphid !== 'undefined';
    }

    function loadImage(v) {
      d3.select("#" + StringUtils.encodeID(v.title)).append("image")
        .attr("transform", "translate(2,2)")
        .attr("xlink:href", function (v) {
          var url = v.imageUrl;
          var simg = this;
          var img = new Image();
          img.onload = function () {
            simg.setAttribute("width", nodeWidth - 4);
            simg.setAttribute("height", nodeHeight - 4);
          }
          return img.src = url;
        }).on("click", function () {
          click(v)
        });
    }

    function addViewNode(v, startpos) {
      v.viewgraphid = viewgraph.nodes.length;
      if (typeof startpos !== 'undefined') {
        v.x = startpos.x;
        v.y = startpos.y;
      }
      viewgraph.nodes.push(v);
    }

    function populateArticleSummary(node) {
      $("#wikipediaArticleLink").attr('href', 'http://en.wikipedia.org/wiki/' + node.title);
      $("#wikipediaArticleLinkLabel").text(node.title);
      $('#articleContent').text(node.summaryText);
      $('#articleImage').attr("src", node.imageUrl);
    }

    function click(node) {
      populateArticleSummary(node);
      if (node.color !== red)
      {
        return;
      }
      var focus = modelgraph.getNode(node.title);
      refocus(focus);
    }

    function update() {
      d3cola.nodes(viewgraph.nodes)
        .links(viewgraph.links)
        .start();

      var link = edgesLayer.selectAll(".link")
        .data(viewgraph.links);

      link.enter().append("rect")
        .attr("x", 0).attr("y", 0)
        .attr("height", 2)
        .attr("class", "link");

      link.exit().remove();

      link
        .attr("fill", function (d) {
          if (d.source.color === red && d.target.color === red) return red;
          if (d.source.color !== red && d.target.color !== red) return "darkgray";
          return d.source.color === red ? "url(#ReverseEdgeGradient)" : "url(#EdgeGradient)";
        });

      var node = nodesLayer.selectAll(".node")
        .data(viewgraph.nodes, function (d) { return d.viewgraphid; })

      var nodeEnter = node.enter().append("g")
        .attr("id", function (d) { return StringUtils.encodeID(d.title) })
        .attr("class", "node" )
        .on("mousedown", function () { nodeMouseDown = true; }) // recording the mousedown state allows us to differentiate dragging from panning
        .on("mouseup", function () { nodeMouseDown = false; })
        .on("touchmove", function () { d3.event.preventDefault() })
        .call(d3cola.drag)
        .on('mouseover', tip.show)
        .on('mouseout', tip.hide);

      nodeEnter.append("g").attr("id", function (d) { return StringUtils.encodeID(d.title) + "_spikes" })
        .attr("transform", "translate(3,3)");

      nodeEnter.append("rect")
        .attr("rx", 5).attr("ry", 5)
        .style("stroke-width","0")
        .attr("width", nodeWidth).attr("height", nodeHeight)
        .on("click", function (d) { click(d) })
        .on("touchend", function (d) { click(d) });

      nodeEnter.append("title")
        .text(function (d) { return d.label; });

      node.style("fill", function (d) { return d.color; });

      d3cola.on("tick", function () {
        link.attr("transform", function (d) {
          var dx = d.source.x - d.target.x, dy = d.source.y - d.target.y;
          var r = 180 * Math.atan2(dy, dx) / Math.PI;
          return "translate(" + d.target.x + "," + d.target.y + ") rotate(" + r + ") ";
        }).attr("width", function (d) {
          var dx = d.source.x - d.target.x, dy = d.source.y - d.target.y;
          return Math.sqrt(dx * dx + dy * dy);
        });
        node.attr("transform", function (d) { return "translate(" + (d.x - nodeWidth/2) + "," + (d.y-nodeHeight/2) + ")"; });
      });
    }

    function graphBounds() {
      var x = Number.POSITIVE_INFINITY, X=Number.NEGATIVE_INFINITY, y=Number.POSITIVE_INFINITY, Y=Number.NEGATIVE_INFINITY;
      nodesLayer.selectAll(".node").each(function (v) {
        x = Math.min(x, v.x - nodeWidth / 2);
        X = Math.max(X, v.x + nodeWidth / 2);
        y = Math.min(y, v.y - nodeHeight / 2);
        Y = Math.max(Y, v.y + nodeHeight / 2);
      });
      return { x: x, X: X, y: y, Y: Y };
    }

    function zoomToFit() {
      var b = graphBounds();
      var w = b.X - b.x, h = b.Y - b.y;
      var cw = outer.attr("width"), ch = outer.attr("height");
      var s = Math.min(cw / w, ch / h);
      var tx = (-b.x * s + (cw / s - w) * s / 2), ty = (-b.y * s + (ch / s - h) * s / 2);
      zoom.translate([tx, ty]).scale(s);
      redraw(true);
    }
}
