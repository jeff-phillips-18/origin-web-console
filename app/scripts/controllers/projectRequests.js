'use strict';
/* jshint unused: false */

/**
 * @ngdoc function
 * @name openshiftConsole.controller:ProjectRequestsController
 * @description
 * # ProjectRequestsController
 * Controller of the ProjectRequestsController
 */
angular.module('openshiftConsole')
  .controller('ProjectRequestsController', function($filter,
                                                    $location,
                                                    $scope,
                                                    $routeParams,
                                                    APIService,
                                                    AuthService,
                                                    DataService,
                                                    HomePagePreferenceService,
                                                    KeywordService,
                                                    Navigate,
                                                    ProjectsService) {
    var debug = false;

    var configMapsVersion = APIService.getPreferredVersion('configmaps');
    var serviceInstancesVersion = APIService.getPreferredVersion('serviceinstances');

    var limitWatches = $filter('isIE')();
    var DEFAULT_POLL_INTERVAL = 60 * 1000; // milliseconds

    var watches = [];
    var configMaps;
    var serviceInstances;

    $scope.projectName = $routeParams.requestproject;
    $scope.pendingRequests = [];

    $scope.navigateTo = function(request) {
      $location.url('quotas/requests/' + $scope.projectName + '/' + request.serviceInstance.metadata.name);
    };

    var parseYAML = function(yamlData) {
      return jsyaml.safeLoad(yamlData, {
        json: true
      });
    };

    var nextApproverCount = function(approvalStatus) {
      for (var i = 1; i <= approvalStatus.num_approvers; i++) {
        if (approvalStatus['approver_' + i + '_status'] === 'Notified') {
          return i;
        }
      }
      return 0;
    };

    var hasPendingConfigMap = function(serviceInstance) {
      if (!debug) {
        return false;
      }

      var hasPendingApprover = function(approvalStatus) {
        for (var i = 1; i <= approvalStatus.num_approvers; i++) {
          var status = approvalStatus['approver_' + i + '_status'];
          if (status === 'Notified' ||status === 'Pending') {
            return true;
          }
        }
        return false;
      };

      var approvalMapName = serviceInstance.metadata.uid + '-status';
      var approvalStatusYAML = _.get(_.get(configMaps, approvalMapName), 'data.status');

      return approvalStatusYAML && hasPendingApprover(parseYAML(approvalStatusYAML));
    };

    var updatePendingRequests = function() {
      if (!configMaps || !serviceInstances) {
        return;
      }

      $scope.pendingRequests = [];
      _.each(serviceInstances, function(serviceInstance) {
        if (_.get(serviceInstance, 'status.asyncOpInProgress') || hasPendingConfigMap(serviceInstance)) {
          var approvalMapName = serviceInstance.metadata.uid + '-status';
          var approvalStatusYAML = _.get(_.get(configMaps, approvalMapName), 'data.status');
          var approvalStatus = {};
          if (approvalStatusYAML) {
            approvalStatus = parseYAML(approvalStatusYAML);
            approvalStatus.serviceInstance = serviceInstance;

            var nextApprover = nextApproverCount(approvalStatus);
            if (approvalStatus && nextApprover) {
              approvalStatus.requestTimestamp = _.get(serviceInstance, 'metadata.creationTimestamp');
              approvalStatus.approvalStatus = 'Step ' + nextApprover + ' of ' + approvalStatus.num_approvers;
              approvalStatus.approver = approvalStatus['approver_' + nextApprover + '_name'];
              approvalStatus.approvalRequestTimestamp = approvalStatus['approver_' + nextApprover + '_initiated_at'];
            }
          } else {
            approvalStatus.serviceInstance = serviceInstance;
            approvalStatus.requester = "unknown";
          }
          $scope.pendingRequests.push(approvalStatus);
        }
      });
    };

    var update = function() {
      var requestsLoading = true;
      var servicesLoading = true;

      // Get the config maps
      watches.push(DataService.watch(configMapsVersion, $scope.context, function(configMapData) {
          configMaps = configMapData.by("metadata.name");
          updatePendingRequests();

          requestsLoading = false;
          $scope.loading = $scope.loading && (servicesLoading || requestsLoading);
        },
        function(e) {
        }
      ));

      // Get the services to find any that are pending approvals
      watches.push(DataService.watch(serviceInstancesVersion, $scope.context, function (serviceInstancesData) {
        serviceInstances = _.sortBy(serviceInstancesData.by("metadata.name"), "metadata.creationTimestamp");

        updatePendingRequests();

        servicesLoading = false;
        $scope.loading = $scope.loading && (servicesLoading || requestsLoading);
      }, {poll: limitWatches, pollInterval: DEFAULT_POLL_INTERVAL}));
    };

    $scope.loading = true;
    ProjectsService.get($scope.projectName).then(_.spread(function(project, context) {
      $scope.project = project;
      $scope.context = context;
      update();
    }, function(e) {
      Navigate.toProjectList();
    }));

    $scope.$on('$destroy', function(){
      DataService.unwatchAll(watches);
    });
  });
