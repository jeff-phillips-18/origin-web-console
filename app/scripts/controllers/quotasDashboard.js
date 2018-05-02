'use strict';
/* jshint unused: false */

/**
 * @ngdoc function
 * @name openshiftConsole.controller:QuotasDashboardController
 * @description
 * # QuotasDashboardController
 * Controller of the openshiftConsole
 */
angular.module('openshiftConsole')
  .controller('QuotasDashboardController', function ($filter,
                                                     $scope,
                                                     APIService,
                                                     AuthService,
                                                     DataService,
                                                     KeywordService,
                                                     Navigate,
                                                     ProjectsService) {
    var debug = false;

    var configMapsVersion = APIService.getPreferredVersion('configmaps');
    var serviceInstancesVersion = APIService.getPreferredVersion('serviceinstances');

    var limitWatches = $filter('isIE')();
    var DEFAULT_POLL_INTERVAL = 60 * 1000; // milliseconds

    var projects, sortedProjects;
    var watches = [];
    var filterKeywords = [];

    var filterFields = [
      'metadata.name',
      'metadata.annotations["openshift.io/display-name"]',
      'metadata.annotations["openshift.io/description"]',
      'metadata.annotations["openshift.io/requester"]'
    ];

    var filterProjects = function() {
      $scope.projects =
        KeywordService.filterForKeywords(sortedProjects, filterFields, filterKeywords);
    };

    var previousSortID, displayName = $filter('displayName');
    var sortProjects = function() {
      var sortID = _.get($scope, 'sortConfig.currentField.id');

      if (previousSortID !== sortID) {
        // Default to desc for creation timestamp. Otherwise default to asc.
        $scope.sortConfig.isAscending = sortID !== 'metadata.creationTimestamp';
      }

      var displayNameLower = function(project) {
        // Perform a case insensitive sort.
        return displayName(project).toLowerCase();
      };

      var primarySortOrder = $scope.sortConfig.isAscending ? 'asc' : 'desc';
      switch (sortID) {
        case 'metadata.annotations["openshift.io/display-name"]':
          // Sort by display name. Use `metadata.name` as a secondary sort when
          // projects have the same display name.
          sortedProjects = _.orderBy(projects,
            [ displayNameLower, 'metadata.name' ],
            [ primarySortOrder ]);
          break;
        case 'metadata.annotations["openshift.io/requester"]':
          // Sort by requester, then display name. Secondary sort is always ascending.
          sortedProjects = _.orderBy(projects,
            [ sortID, displayNameLower ],
            [ primarySortOrder, 'asc' ]);
          break;
        default:
          sortedProjects = _.orderBy(projects,
            [ sortID ],
            [ primarySortOrder ]);
      }

      // Remember the previous sort ID.
      previousSortID = sortID;
    };

    var parseYAML = function(yamlData) {
      return jsyaml.safeLoad(yamlData, {
        json: true
      });
    };

    var hasPendingConfigMap = function(project, serviceInstance) {
      if (!debug) {
        return false;
      }

      console.log("service instance: " + serviceInstance.metadata.name);
      console.log(serviceInstance.spec.externalID);
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
      var approvalStatusYAML = _.get(_.get(project.configMaps, approvalMapName), 'data.status');

      return approvalStatusYAML && hasPendingApprover(parseYAML(approvalStatusYAML));
    };

    var updatePendingRequests = function(project) {
      if (!project.configMaps || !project.serviceInstances) {
        return;
      }

      project.pendingRequestsCount = 0;
      project.pendingRequests = [];
      _.each(project.serviceInstances, function(serivceInstance) {
        if (_.get(serivceInstance, 'status.asyncOpInProgress') || hasPendingConfigMap(project, serivceInstance)) {
          project.pendingRequestsCount++;
        }
      });
    };

    var update = function() {
      if (projects) {
        sortProjects();
        filterProjects();

        var quotasLoading = true;
        var servicesLoading = true;
        var quotasLoaded = 0;
        var servicesLoaded = 0;

        _.each($scope.projects, function(project) {
          var context = {
            namespace: project.metadata.name
          };

          // Get the quota config map
          watches.push(DataService.watch(configMapsVersion, context, function (configMapData) {
            project.configMaps = configMapData.by("metadata.name");
            var quotaMap = _.get(project.configMaps, 'redhat-quota.data.quota');
            if (quotaMap) {
              project.quotaData = parseYAML(quotaMap);
              updatePendingRequests(project);
            } else {
              _.remove($scope.projects, function(nextProject) {
                return nextProject === project;
              });
            }

            if (++quotasLoaded >= _.size($scope.projects)) {
              quotasLoading = false;
              $scope.loading = $scope.loading && (servicesLoading || quotasLoading);
            }
          }));

          watches.push(DataService.watch(serviceInstancesVersion, context, function(serviceInstances) {
            project.serviceInstances = serviceInstances.by('metadata.name');
            updatePendingRequests(project);

            if (++servicesLoaded >= _.size($scope.projects)) {
              servicesLoading = false;
              $scope.loading = $scope.loading && (servicesLoading || quotasLoading);
            }
          }, {poll: limitWatches, pollInterval: DEFAULT_POLL_INTERVAL}));
        });
      }
    };

    $scope.newProjectPanelShown = false;

    $scope.createProject = function(event) {
      var button =_.get(event, 'target');
      while (button && !angular.element(button).hasClass('btn')) {
        button = button.parentElement;
      }
      $scope.popupElement = button;
      $scope.newProjectPanelShown = true;
    };

    $scope.closeNewProjectPanel = function() {
      $scope.newProjectPanelShown = false;
    };

    $scope.onNewProject = function(projectName) {
      $scope.newProjectPanelShown = false;
      Navigate.toProjectOverview(projectName);
    };

    // Set up the sort configuration for `pf-sort`.
    $scope.sortConfig = {
      fields: [{
        id: 'metadata.annotations["openshift.io/display-name"]',
        title: 'Display Name',
        sortType: 'alpha'
      }, {
        id: 'metadata.name',
        title: 'Name',
        sortType: 'alpha'
      }, {
        id: 'metadata.annotations["openshift.io/requester"]',
        title: 'Creator',
        sortType: 'alpha'
      }, {
        id: 'metadata.creationTimestamp',
        title: 'Creation Date',
        sortType: 'alpha'
      }],
      isAscending: true,
      onSortChange: update
    };


    var updateProjects = function(projectData) {
      projects = _.toArray(projectData.by("metadata.name"));
      update();
    };

    $scope.$watch('search.text', _.debounce(function(searchText) {
      $scope.keywords = filterKeywords = KeywordService.generateKeywords(searchText);
      $scope.$applyAsync(filterProjects);
    }, 350));

    $scope.loading = true;
    watches.push(ProjectsService.watch($scope, function(projectData) {
      updateProjects(projectData);
    }));

    $scope.$on('$destroy', function(){
      DataService.unwatchAll(watches);
    });
  });
