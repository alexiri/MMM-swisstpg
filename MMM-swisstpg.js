Module.register('MMM-swisstpg', {
  // Default module config.
  defaults: {
    routes: {},
    // routes: {
    //   'PRRI': [
    //     { 'line': '6', 'direction': 'GENEVE-PLAGE' },
    //     { 'line': '9', 'direction': 'PETIT-BEL-AIR' },
    //   ],
    // },

    maxDepartures: 6,
    maxWaitTime: 30,

    animationSpeed: 1000,
    updateInterval: 10 * 1000, // 10 seconds
    initialLoadDelay: 0, // 0 seconds delay
    retryDelay: 2500,

    apiBase: 'http://prod.ivtr-od.tpg.ch',
    apiVersion: 'v1'
  },

  getScripts: function() {
    return [
      'moment.js',
      this.file('node_modules/jquery/dist/jquery.slim.min.js'),
      this.file('node_modules/underscore/underscore-min.js'),
     ];
  },

  getStyles: function() {
    return [ this.file('css/MMM-swisstpg.css') ];
  },

  getTranslations: function() {
    return {
      en: 'translations/en.json',
      es: 'translations/es.json',
    }
  },

  start: function() {
    Log.info('Starting module: ' + this.name);

    // Set locale
    moment.locale(config.language);

    this.departures = {};

    this.loaded = false;
		this.scheduleUpdate(this.config.initialLoadDelay);

  },

  scheduleUpdate: function(delay) {
    var nextLoad = this.config.updateInterval;
		if (typeof delay !== "undefined" && delay >= 0) {
			nextLoad = delay;
		}

		var self = this;
		setTimeout(function() {

      for (var stop in self.config.routes) {
        self.sendQuery('GetNextDepartures', {
            'stopCode': stop,
            'linesCode': _.map(self.config.routes[stop], function(x) { return x.line; }).join(','),
            'destinationsCode': _.map(self.config.routes[stop], function(x) { return x.direction; }).join(','),
        });
      }

		}, nextLoad);
  },

  // Override dom generator.
  getDom: function() {
    var wrapper = document.createElement("div");

    if (this.config.apiKey === "") {
			wrapper.innerHTML = "Please set the correct TPG Open Data <i>apiKey</i> in the config for module: " + this.name + ".";
			wrapper.className = "dimmed light small";
			return wrapper;
		}

		if (this.config.routes === {}) {
			wrapper.innerHTML = "Please define some <i>routes</i> in the config for module: " + this.name + ".";
			wrapper.className = "dimmed light small";
			return wrapper;
		}

    if (_.keys(this.departures).length === 0) {
			wrapper.innerHTML = (this.loaded) ? this.translate("EMPTY") : this.translate("LOADING");
			wrapper.className = "dimmed light small";
			return wrapper;
		}

    var template = `
    <table class='normal'>
      <tr>
        <% _.each(departures, function(busses, stop){ %>
          <th><%- stop %></th>
        <% }); %>
      </tr>
      <tr>
        <% _.each(departures, function(busses, stop){ %>
          <td>
            <table>
              <tr class='small'>
                <th><%= translate('line') %></th>
                <th><%= translate('direction') %></th>
                <th><%= translate('wait') %></th>
              </tr>
              <% for (var d in busses) { %>
                <tr class='small'>
                  <td><%- busses[d].line.lineCode %></td>
                  <td><%- busses[d].line.destinationName %></td>
                  <td><%- translate(busses[d].waitingTime) %></td>
                </tr>
                <% if (d >= config.maxDepartures || busses[d].waitingTime >= config.maxWaitTime) { break; } %>
              <% } %>
            </table>
          </td>
        <% }); %>
      </tr>
    </table>
    `;

    var t = _.template(template);
    var $div = $(
      t({
         departures: this.departures,
         translate: this.translate,
         config: this.config,
       })
    );

    return $div[0];
  },

  sendQuery: function(endpoint, params) {
    return this.sendSocketNotification(endpoint, {
      apiBase: this.config.apiBase,
      apiVersion: this.config.apiVersion,
      apiKey: this.config.apiKey,
      params: params
    });
  },

  socketNotificationReceived: function(notification, payload) {
    if (notification === 'QUERY_RESULT') {
      Log.info('Query result: ' + payload.endpoint);
      Log.info(payload.result);
      if (payload.endpoint === 'GetNextDepartures') {
        this.departures[payload.result.stop.stopName] = payload.result.departures;
        this.loaded = true;
        this.scheduleUpdate();
      } else if (payload.endpoint === 'GetLinesColors') {
        var sheet = document.createElement('style');
        _.each(payload.result.colors, function(color) {
          sheet.innerHTML = sheet.innerHTML + '.line-' + color.lineCode + ' td.line { background-color: #' + color.hexa + '} ';
        });
        document.body.appendChild(sheet);
      }
		} else if (notification === 'QUERY_ERROR') {
			Log.error('Query Error: ' + payload.url);
      this.scheduleUpdate((this.loaded) ? -1 : this.config.retryDelay);
		} else {
			Log.log('Received an unknown socket notification: ' + notification);
      this.scheduleUpdate((this.loaded) ? -1 : this.config.retryDelay);
		}

		this.updateDom(this.config.animationSpeed);
  },

});
