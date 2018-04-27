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
                                                     ProjectsService) {
    var configMapsVersion = APIService.getPreferredVersion('configmaps');
    var servicesVersion = APIService.getPreferredVersion('services');

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
      // https://github.com/nodeca/js-yaml#safeload-string---options-
      return jsyaml.safeLoad(yamlData, {
        json: true
      });
    };

    var isApprovalPending = function(approvalStatus) {
      for (var i = 1; i <+ approvalStatus.num_approvers; i++) {
        if (approvalStatus['approver_' + i + '_status'] === 'Pending') {
          return true;
        }
      }
      return false;
    };

    var updatePendingRequests = function(project) {
      if (!project.configMaps || !project.services) {
        return;
      }

      project.pendingRequestsCount = 0;
      project.pendingRequests = [];
      _.each(project.services, function(service) {
        var approvalMapName = service.metadata.uid + '-status';
        var approvalStatusYAML = _.get(_.get(project.configMaps, approvalMapName), 'data.status');
        var approvalStatus = approvalStatusYAML && parseYAML(approvalStatusYAML);

        if (approvalStatus && isApprovalPending(approvalStatus)) {
          project.pendingRequestsCount++;
          project.pendingRequests.push(approvalStatus);
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
          watches.push(DataService.watch(configMapsVersion, context, function(configMapData) {
            project.configMaps = configMapData.by("metadata.name");
            project.quotaData = parseYAML(_.get(project.configMaps, 'redhat-quota.data.quota'));
            updatePendingRequests(project);

            if (++quotasLoaded >= _.size($scope.projects)) {
              quotasLoading = false;
              $scope.loading = $scope.loading && (servicesLoading || quotasLoading);
            }
          }));

          // Get the services to find any that are pending approvals
          watches.push(DataService.watch(servicesVersion, context, function(serviceData) {
            project.services = serviceData.by("metadata.name");
            updatePendingRequests(project);

            if (++servicesLoaded >= _.size($scope.projects)) {
              servicesLoading = false;
              $scope.loading = $scope.loading && (servicesLoading || quotasLoading);
            }
          }, {poll: limitWatches, pollInterval: DEFAULT_POLL_INTERVAL}));
        });
      }
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
