'use strict';
/* jshint unused: false */

/**
 * @ngdoc function
 * @name openshiftConsole.controller:ServiceRequestFlowController
 * @description
 * # ServiceRequestFlowController
 * Controller of the openshiftConsole
 */
angular.module('openshiftConsole')
  .controller('ServiceRequestFlowController', function($document,
                                                       $filter,
                                                       $location,
                                                       $scope,
                                                       $routeParams,
                                                       APIService,
                                                       AuthService,
                                                       ChartViewService,
                                                       DataService,
                                                       HTMLService,
                                                       Navigate,
                                                       ProjectsService) {
    var configMapsVersion = APIService.getPreferredVersion('configmaps');
    var serviceInstancesVersion = APIService.getPreferredVersion('serviceinstances');

    var limitWatches = $filter('isIE')();
    var DEFAULT_POLL_INTERVAL = 60 * 1000; // milliseconds

    var watches = [];

    $scope.projectName = $routeParams.requestproject;
    $scope.serviceName = $routeParams.service;

    $scope.connectorSize = ChartViewService.connectorSize;

    var parseYAML = function(yamlData) {
      return jsyaml.safeLoad(yamlData, {
        json: true
      });
    };

    var updatePendingRequest = function() {
      // Get the pending request config map
      var approvalMapName = $scope.service.metadata.uid + '-status';
      watches.push(DataService.watchObject(configMapsVersion, approvalMapName, $scope.context, function(configMap) {
        var approvalStatusYAML = _.get(configMap, 'data.status');
        var approvalStatus = approvalStatusYAML && parseYAML(approvalStatusYAML);

        $scope.data = {
          nodes: [],
          connections: []
        };

        $scope.data.nodes.push(
          {
            id: 1,
            type: 'initial',
            status: 'Initiated',
            requester: _.get(approvalStatus, 'requester'),
            initiatedTimestamp: _.get($scope.service, 'metadata.creationTimestamp'),
            width: 230,
            height: 150,
            yOffset: $scope.isMobile ? 0 : 75
          }
        );

        for (var i = 1; i <= approvalStatus.num_approvers; i++) {
          var status = _.get(approvalStatus, 'approver_' + i + '_status');
          var statusIconClass;
          if (status === 'Approved') {
            statusIconClass= 'pficon pficon-ok';
          } else if (status === 'Notified') {
            statusIconClass= 'fa fa-spinner';
          } else if (status === 'Pending') {
            statusIconClass= 'pficon pficon-pending';
          } else if (status === 'Denied') {
            statusIconClass= 'pficon pficon-error-circle-o';
          } else if (status === 'Skipped') {
            statusIconClass= 'pficon pficon-info';
          }

          $scope.data.nodes.push(
            {
              id: i + 1,
              parentId: $scope.isMobile ? undefined : i,
              prevSiblingId: $scope.isMobile ? i : undefined,
              type: 'approval',
              status: status,
              statusIconClass: statusIconClass,
              approverName: _.get(approvalStatus, 'approver_' + i + '_name'),
              approverUrl: _.get(approvalStatus, 'approver_' + i + '_url'),
              initiatedTimestamp: parseInt(_.get(approvalStatus, 'approver_' + i + '_initiated_at')),
              approvalTimestamp: parseInt(_.get(approvalStatus, 'approver_' + i + '_approved_at')),
              xOffset: $scope.isMobile ? 25 : 0
            });
            $scope.data.connections.push(
              {
                source: {
                  nodeID: i,
                  connectorIndex: $scope.isMobile ? 1 : 0
                },
                dest: {
                  nodeID: i + 1,
                  connectorIndex:  $scope.isMobile ? 1 : 0
                }
              }
            );
        }
        $scope.chart = ChartViewService.createChartViewModel($scope.data);
        $scope.loading = false;
      }));
    };

    var updateService = function() {
      // Get the services to find any that are pending approvals
      watches.push(DataService.watchObject(serviceInstancesVersion, $scope.serviceName, $scope.context, function(service) {
        $scope.service = service;
        updatePendingRequest();
      }, {poll: limitWatches, pollInterval: DEFAULT_POLL_INTERVAL}));
    };

    $scope.foreignObjectSupported = $document[0].implementation.hasFeature('http://www.w3.org/TR/SVG11/feature#Extensibility', '1.1');

    $scope.loading = true;
    ProjectsService.get($scope.projectName).then(_.spread(function(project, context) {
      $scope.project = project;
      $scope.context = context;
      updateService();
    }, function(e) {
      Navigate.toProjectList();
    }));

    var checkMobile = function() {
      return HTMLService.isWindowBelowBreakpoint(HTMLService.WINDOW_SIZE_SM);
    };

    $scope.isMobile = checkMobile();

    var onResize = _.throttle(function() {
      var isMobile = checkMobile();
      if (isMobile !== $scope.isMobile) {
        $scope.$evalAsync(function() {
          $scope.isMobile = isMobile;
          updatePendingRequest();
        });
      }
    }, 50);
    $(window).on('resize.workflow', onResize);

    $scope.$on('$destroy', function(){
      DataService.unwatchAll(watches);
      $(window).off('.workflow');
    });
  });
