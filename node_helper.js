var NodeHelper = require("node_helper");
var request = require('request');

module.exports = NodeHelper.create({
  start: function() {
    console.info('Starting node helper for: ' + this.name);
  },

  // Override socketNotificationReceived method.
	socketNotificationReceived: function(notification, payload) {
    //console.log(notification);
		//if (notification === 'QUERY_API') {
			//console.log('ADD_CALENDAR: ');
			this.queryAPI(payload.apiBase, payload.apiVersion, payload.apiKey, notification, payload.params);
		//}
	},

  queryAPI: function(apiBase, apiVersion, apiKey, endpoint, params) {
    var url = apiBase + '/' + apiVersion + '/' + endpoint;

    url += '?key=' + apiKey;
    for (var key in params) {
      url += '&' + key + '=' + params[key];
    }

    //console.log(url);
    self = this;
    request(url, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        self.sendSocketNotification('QUERY_RESULT', {
          url: url,
          endpoint: endpoint,
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
