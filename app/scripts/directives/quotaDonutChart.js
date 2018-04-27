'use strict';

(function() {
  angular.module('openshiftConsole').component('quotaDonutChart', {
    controller: [
      '$filter',
      QuotaDonutChart
    ],
    controllerAs: 'ctrl',
    bindings: {
      quotaTitle: '@',
      quotaIconClass: '@',
      units: '@',
      valuePrefix: '@',
      chartId: '@',
      total: '<',
      used: '<'
    },
    templateUrl: 'views/directives/quota-donut-chart.html'
  });

  function QuotaDonutChart() {
    var ctrl = this;

    var getCenterLabel = function() {
      return '';
    };

    var getQuotaConfig = function() {
      return {
        chartId: ctrl.chartId,
        thresholds: {warning: 75, error: 90},
        centerLabelFn: getCenterLabel,
        label: 'none',
        donut: {
          width: 5
        },
        size: {
          height: 75
        },
      };
    };

    var getQuotaData = function() {
      if (!ctrl.total || Number.isNaN(ctrl.total)) {
        return {
          dataAvailable: false,
          tooltip: ctrl.quotaTitle + ': No Quota Available'
        };
      }

      if (Number.isNaN(ctrl.used)) {
        ctrl.used = 0;
      }

      return {
        used: ctrl.used,
        percent: Math.round(ctrl.used / ctrl.total * 100.0),
        total: ctrl.total,
        dataAvailable: true,
        thresholds: {warning: 75, error: 90},
        tooltip: ctrl.quotaTitle + ': ' +
          (ctrl.valuePrefix || '') + ctrl.used +
          ' of ' + (ctrl.valuePrefix || '') +
          ctrl.total + ' ' + (ctrl.units || '')
      };
    };

    ctrl.quotaConfig = getQuotaConfig();
//    ctrl.quotaData = getQuotaData();

    ctrl.$onChanges = function(onChangeObj) {
      if (onChangeObj.total || onChangeObj.used) {
        ctrl.quotaData = getQuotaData();
      }
    };
  }
})();
