'use strict';

(function() {
  angular.module('openshiftConsole').component('quotaUtilizationBar', {
    controller: [
      '$filter',
      QuotaUtilizationBar
    ],
    controllerAs: 'ctrl',
    bindings: {
      quotaTitle: '@',
      quotaIconClass: '@',
      units: '@',
      valuePrefix: '@',
      warningThreshold: '<',
      project: '<',
      allowedLabel: '@',
      allocatedLabel: '@'
    },
    templateUrl: 'views/directives/quota-utilization-bar.html'
  });

  function QuotaUtilizationBar($filter) {
    var ctrl = this;
    var labelFilter = $filter('label');

    var getQuotaStatusClass = function(percentUsed) {
      if (percentUsed < 75) {
        return 'progress-bar-success';
      } else if (percentUsed < 90) {
        return 'progress-bar-warning';
      } else {
        return 'progress-bar-danger';
      }
    };

    var getQuotaData = function(project, allowedLabel, allocatedLabel) {
      var allowed = parseInt(labelFilter(project, allowedLabel), 10);
      var allocated = parseInt(labelFilter(project, allocatedLabel), 10);

      if (!allowed || Number.isNaN(allowed)) {
        return {
          dataAvailable: false
        };
      }

      if (Number.isNaN(allocated)) {
        allocated = 0;
      }

      var percentUsed = Math.round((allocated / allowed) * 100);
      return {
        dataAvailable: true,
        used: allocated,
        total: allowed,
        available: allowed - allocated,
        percentUsed: percentUsed,
        percentAvailable: 100 - percentUsed,
        statusClass: getQuotaStatusClass(percentUsed)
      };
    };

    ctrl.quotaData = getQuotaData(ctrl.project, ctrl.allowedLabel, ctrl.allocatedLabel);

    ctrl.$onChanges = function() {
      ctrl.quotaData = getQuotaData(ctrl.project, ctrl.allowedLabel, ctrl.allocatedLabel);
    };
  }
})();
