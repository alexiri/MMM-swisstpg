var NodeHelper = require("node_helper");
var request = require('request');

module.exports = NodeHelper.create({
  start: function() {
    console.info('Starting node helper for: ' + this.name);
  },

  // Override socketNotificationReceived method.
  socketNotificationReceived: function(notification, payload) {
    // console.log("node_helper received" + notification, payload);
    this.queryAPI(payload.apiBase, notification, payload.params);
  },

  queryAPI: function(apiBase, endpoint, params) {
    // apiBase: 'https://search.ch/timetable/api/stationboard.json'
    // https://search.ch/timetable/api/stationboard.json?stop=8592890&show_delays=1
    var url = apiBase + '?';
    for (var key in params) {
      url += '&' + key + '=' + params[key];
    }

    console.log('queryAPI: ' + url);
    self = this;
    request({
      url: url,
      strictSSL: false,
      }, function (error, response, body) {
      if (!error && response && response.statusCode == 200) {
        self.sendSocketNotification('QUERY_RESULT', {
          url: url,
          endpoint: endpoint,
          result: JSON.parse(body)
        });

      } else {
        self.sendSocketNotification('QUERY_ERROR', {
          url: url,
          status: (response ? response.statusCode : -1),
          error: error
        });
      }
    });
  }

});
