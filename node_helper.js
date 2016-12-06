var NodeHelper = require("node_helper");
var request = require('request');

module.exports = NodeHelper.create({
  start: function() {
    console.info('Starting node helper for: ' + this.name);
  },

  // Override socketNotificationReceived method.
	socketNotificationReceived: function(notification, payload) {
		if (notification === "QUERY_API") {
			//console.log('ADD_CALENDAR: ');
			this.queryAPI(payload.apiBase, payload.apiVersion, payload.apiKey, payload.endpoint, payload.params);
		}
	},

  queryAPI: function(apiBase, apiVersion, apiKey, endpoint, params) {
    var url = apiBase + '/' + apiVersion + '/' + endpoint;

    url += '?key=' + apiKey;
    for (var key in params) {
      url += '&' + key + '=' + params[key];
    }

    self = this;
    request(url, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        self.sendSocketNotification('QUERY_RESULT', {
          result: JSON.parse(body)
				});

      } else {
        self.sendSocketNotification('QUERY_ERROR', {
					url: url,
          status: response.statusCode,
					error: error
				});
      }
    });
  }

});
