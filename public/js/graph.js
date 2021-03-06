/**
 * Created by david on 3/30/2015.
 */

var Node = require('./node.js');
var Edge = require('./edge.js');
var Promise = require('bluebird');
var $ = require('jquery');
var StringUtils = new (require('./string_utils.js'));

function Graph() {
  this.nodes = {};
  this.edges = {};

  Graph.prototype.addNode = function (title) {
    var node = new Node(title);
    return this.nodes[StringUtils.encodeID(node.title)] = node;
  };

  Graph.prototype.getNode = function (title, callback) {
    var _this = this;
    var encodedArticleTitle = StringUtils.encodeID(title);
    if (encodedArticleTitle in this.nodes) {
      return this.nodes[encodedArticleTitle];
    }

    var node = _this.addNode(title);
    if (callback) {
      callback(node);
    }

    var promise = articlePromise(title);
    return promise.then(function (data) {
      node.imageUrl = data.imageUrl;
      node.summaryText = data.summaryText;
      node.links = data.links;
      return node;
    });
  };

  Graph.prototype.addEdge = function (fromNode, toNode) {
    var edge = new Edge(StringUtils.encodeID(fromNode.title), StringUtils.encodeID(toNode.title));
    var edgeName = edge.toString();
    if (!(edgeName in this.edges)) {
      this.edges[edgeName] = edge;
    }
    ++fromNode.degree;
    ++toNode.degree;
  };

  Graph.prototype.isFullyExpanded = function (node) {
    var _this = this;
    return node.links && node.links.every(function(articleTitle) {
     var elementNode = new Node(articleTitle);
        return StringUtils.encodeID(elementNode.title) in _this.nodes;
    })
  };

  Graph.prototype.expandNeighbours = function (node, callback) {
    var _this = this;
    var promisesArray = node.links.map(function (articleTitle) {
      var linkNodeObject = new Node(articleTitle);
        return _this.getNode(linkNodeObject.title, function(vertex) {
          _this.addEdge(node, vertex);
          callback(vertex);
        });
    });

    return Promise.all(promisesArray);
  };
}

function articlePromise(title) {
  return Promise.resolve(
    $.ajax({
      url: 'http://wikigrapher.com/wikimaps/getArticleInfo',
      data: {title: title},
      dataType: 'json'
    }));
}

module.exports = Graph;

