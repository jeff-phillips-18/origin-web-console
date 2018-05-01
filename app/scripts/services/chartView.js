'use strict';

angular.module("openshiftConsole")
  .factory("ChartViewService", function() {
    var nodeWidth = 180;
    var parentGap = 50;
    var nodeHeight = 300;
    var siblingGap = 100;
    var canvasPadding = 5;
    var connectorSize = 6;

    var createConnectorViewModel = function(_x, _y, _parentNode) {
      //
      // X coordinate of the connector.
      //
      var x = function() {
        return _x;
      };

      //
      // Y coordinate of the connector.
      //
      var y = function() {
        return _y;
      };

      //
      // The parent node that the connector is attached to.
      //
      var parentNode = function() {
        return _parentNode;
      };

      return {
        name: name,
        x: x,
        y: y,
        parentNode: parentNode
      };
    };

    //
    // Create view model for a list of data models.
    //
    var createInputConnectorsViewModel = function(node) {
      return [
        createConnectorViewModel(node.xOffset(), node.yOffset() + (node.height() / 2), node),
        createConnectorViewModel(node.xOffset() + (node.width() / 2), node.yOffset(), node)
      ];
    };

    var createOutputConnectorsViewModel = function(node) {
      return [
        createConnectorViewModel(node.xOffset() + node.width(), node.yOffset() + (node.height() / 2), node),
        createConnectorViewModel(node.xOffset() + (node.width() / 2), node.yOffset() + node.height(), node)
      ];
    };

    //
    // View model for a node.
    //
    var createNodeViewModel = function (data, findNode) {
      var model;
      var inputConnectors;
      var outputConnectors;
      var parentNode;
      var prevSiblingNode;

      var nodeData = function(attr) {
        return data[attr] || "";
      };

      var id = function() {
        return data.id || -1;
      };

      var backgroundColor = function() {
        return data.backgroundColor;
      };

      var parent = function() {
        if (!angular.isDefined(parentNode)) {
          parentNode = findNode(data.parentId);
        }

        return parentNode;
      };

      var prevSibling = function() {
        if (!angular.isDefined(prevSiblingNode)) {
          prevSiblingNode = findNode(data.prevSiblingId);
        }

        return prevSiblingNode;
      };

      var x = function() {
        return (parent() ? parent().x() + parent().width() + parentGap : 0);
      };

      var y = function() {
        return (prevSibling() ? prevSibling().y() + prevSibling().height() + siblingGap : 0);
      };

      var width = function() {
        return data.width || nodeWidth;
      };

      var height = function() {
        return data.height || nodeHeight;
      };

      var xOffset = function() {
        return data.xOffset || 0;
      };

      var yOffset = function() {
        return data.yOffset || 0;
      };

      model = {
        data: data,
        id: id,
        nodeData: nodeData,
        backgroundColor: backgroundColor,
        x: x,
        y: y,
        xOffset: xOffset,
        yOffset: yOffset,
        width: width,
        height: height
      };

      inputConnectors = createInputConnectorsViewModel(model);
      outputConnectors = createOutputConnectorsViewModel(model);

      model.inputConnectors = inputConnectors;
      model.outputConnectors = outputConnectors;

      return model;
    };


    //
    // View model for a connection.
    //
    var createConnectionViewModel = function(data, source, dest, destIndex) {

      var connectionData = function(attr) {
        return data[attr] || "";
      };

      var classes = function() {
        return (data.source.connectorClass || '') + ' ' + (data.dest.connectorClass || '');
      };

      var sourceCoordX = function() {
        return source.parentNode().x() + source.x();
      };

      var sourceCoordY = function() {
        return source.parentNode().y() + source.y();
      };

      var sourceCoord = function() {
        return {
          x: sourceCoordX(),
          y: sourceCoordY()
        };
      };

      var destCoordX = function() {

        return dest.parentNode().x() + dest.x() - (destIndex === 1 ? 0 : 2);
      };

      var destCoordY = function() {
        return dest.parentNode().y() + dest.y() - (destIndex === 1 ? 2 : 0);
      };

      var destCoord = function() {
        return {
          x: destCoordX(),
          y: destCoordY()
        };
      };

      var middleCoordX = function() {
        return Math.abs(sourceCoordX() + ((destCoordX() - sourceCoordX()) / 2));
      };

      var middleCoordY = function() {
        return Math.abs(sourceCoordY() + ((destCoordY() - sourceCoordY()) / 2));
      };

      var middleCoord = function() {
        return {
          x: middleCoordX(),
          y: middleCoordY()
        };
      };

      var destEndPoints = function(size) {
        var p1X, p1Y, p2X, p2Y, p3X, p3Y;

        p1X = destCoordX() + (destIndex === 1 ? 0 : 2);
        p1Y = destCoordY() + (destIndex === 1 ? 2 : 0);

        if (destIndex === 1) {
          p2X = p1X - size;
          p2Y = p1Y - (size * 2);

          p3X = p1X + size;
          p3Y = p1Y - (size * 2);
        } else {
          p2X = p1X - (size * 2);
          p2Y = p1Y - size;

          p3X = p1X - (size * 2);
          p3Y = p1Y + size;

        }

        return p1X + ',' + p1Y + ' ' + p2X + ',' + p2Y + ' ' + p3X + ',' + p3Y;
      };

      return {
        data: data,
        source: source,
        dest: dest,
        classes: classes,
        connectionData: connectionData,
        sourceCoordX: sourceCoordX,
        sourceCoordY: sourceCoordY,
        sourceCoord: sourceCoord,
        destCoordX: destCoordX,
        destCoordY: destCoordY,
        destCoord: destCoord,
        middleCoordX: middleCoordX,
        middleCoordY: middleCoordY,
        middleCoord: middleCoord,
        destEndPoints: destEndPoints
      };
    };

    var createNodesViewModel = function(nodesDataModel) {
      var nodesViewModel = [];

      var findNodeModelById = function (nodeID) {
        for (var i = 0; i < nodesViewModel.length; ++i) {
          var node = nodesViewModel[i];
          if (node.id() === nodeID) {
            return node;
          }
        }

        return null;
      };

      if (nodesDataModel) {
        for (var i = 0; i < nodesDataModel.length; ++i) {
          nodesViewModel.push(createNodeViewModel(nodesDataModel[i], findNodeModelById));
        }
      }

      return nodesViewModel;
    };

    //
    // View model for the chart.
    //

    var createChartViewModel = function(data) {
      var width;
      var height;

      // Create a view-model for nodes.
      var nodes = createNodesViewModel(data.nodes);

      //
      // Find a specific node within the chart.
      //
      var findNode = function(nodeID){
        for (var i = 0; i < nodes.length; ++i) {
          var node = nodes[i];
          if (node.data.id === nodeID) {
            return node;
          }
        }

        throw new Error("Failed to find node " + nodeID);
      };

      //
      // Find a specific input connector within the chart.
      //
      var findInputConnector = function(nodeID, connectorIndex) {
        var node = findNode(nodeID);

        if (!node.inputConnectors || node.inputConnectors.length <= connectorIndex) {
          throw new Error("Node " + nodeID + " has invalid input connectors.");
        }

        return node.inputConnectors[connectorIndex];
      };

      //
      // Find a specific output connector within the chart.
      //
      var findOutputConnector = function(nodeID, connectorIndex) {
        var node = findNode(nodeID);

        if (!node.outputConnectors || node.outputConnectors.length <= connectorIndex) {
          throw new Error("Node " + nodeID + " has invalid input connectors.");
        }

        return node.outputConnectors[connectorIndex];
      };

      //
      // Create a view model for connection from the data model.
      //
      var _createConnectionViewModel = function(connectionDataModel) {
        var sourceConnector = findOutputConnector(connectionDataModel.source.nodeID, connectionDataModel.source.connectorIndex);
        var destConnector = findInputConnector(connectionDataModel.dest.nodeID, connectionDataModel.dest.connectorIndex);

        return createConnectionViewModel(connectionDataModel, sourceConnector, destConnector, connectionDataModel.dest.connectorIndex);
      };

      var maxX = 0;
      var maxY = 0;
      _.each(nodes, function (node) {
        maxX = Math.max(maxX, node.x() + node.xOffset() + node.width());
        maxY = Math.max(maxY, node.y() + node.yOffset() + node.height());
      });

      width = maxX + canvasPadding;
      height = maxY + canvasPadding;

      //
      // Wrap the connections data-model in a view-model.
      //
      var connections = [];

      if (data.connections) {
        for (var i = 0; i < data.connections.length; ++i) {
          connections.push(_createConnectionViewModel(data.connections[i]));
        }
      }

      return {
        data: data,
        nodes: nodes,
        connections: connections,
        width: width,
        height: height
      };
    };

    return {
      createChartViewModel: createChartViewModel,
      connectorSize: connectorSize
    };
  });
