Module.register('MMM-swisstpg', {
  // Default module config.
  defaults: {
    routes: {},
    // routes: {
    //   'PRRI': [
    //     { 'line': '6', 'direction': 'RIVE' },
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
    return [ 'moment.js', this.file('node_modules/underscore/underscore.js') ];
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

        self.sendSocketNotification("QUERY_API", {
          apiBase: self.config.apiBase,
          apiVersion: self.config.apiVersion,
          apiKey: self.config.apiKey,
          endpoint: 'GetNextDepartures',
          params: {
            'stopCode': stop,
            'linesCode': _.map(self.config.routes[stop], function(x) { return x.line; }).join(','),
            'destinationsCode': _.map(self.config.routes[stop], function(x) { return x.direction; }).join(','),
          }
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

    makeCell = function(text) {
      var cell = document.createElement('td');
      cell.innerHTML = text;
      return cell;
    }

    var wrapper = document.createElement('table');
		wrapper.className = "normal";

    var titles = document.createElement('tr');
    for (var stop in this.departures) {
      var t = document.createElement('th');
      t.innerHTML = stop;
      titles.appendChild(t);
    }
    wrapper.appendChild(titles);

    var data = document.createElement('tr');
    for (var stop in this.departures) {
      var t = document.createElement('td');
      var dtable = document.createElement('table');

      var dtr = document.createElement('tr');
      dtr.className = "small";
      dtr.appendChild(makeCell(this.translate('line')));
      dtr.appendChild(makeCell(this.translate('direction')));
      dtr.appendChild(makeCell(this.translate('wait')));
      dtable.appendChild(dtr);

      console.log('Stop: '+ stop);
      var i = 0;
      for (var d in this.departures[stop]) {
        d = this.departures[stop][d];
        var dtr = document.createElement('tr');
        dtr.className = "small";

        dtr.appendChild(makeCell(d.line.lineCode));
        dtr.appendChild(makeCell(d.line.destinationName));
        dtr.appendChild(makeCell(this.translate(d.waitingTime)));

        console.log(d);
        dtable.appendChild(dtr);
        i++;
        if (i >= this.config.maxDepartures || d.waitingTime >= this.config.maxWaitTime) {
          break;
        }
      }
      console.log('****');

      t.appendChild(dtable);
      data.appendChild(t);
    }
    wrapper.appendChild(data);

    return wrapper;
  },

  socketNotificationReceived: function(notification, payload) {
    if (notification === 'QUERY_RESULT') {
      Log.info('Query result');
      Log.info(payload.result);
      this.departures[payload.result.stop.stopName] = payload.result.departures;
      this.loaded = true;
      this.scheduleUpdate();
		} else if (notification === 'QUERY_ERROR') {
			Log.error('Query Error. Could not fetch calendar: ' + payload.url);
      this.scheduleUpdate((this.loaded) ? -1 : this.config.retryDelay);
		} else {
			Log.log('Received an unknown socket notification: ' + notification);
      this.scheduleUpdate((this.loaded) ? -1 : this.config.retryDelay);
		}

		this.updateDom(this.config.animationSpeed);
  },

  // queryAPI: function(endpoint, params) {
  //   var url = this.config.apiBase + '/' + this.config.apiVersion + '/' + endpoint;
  //
  //   url += '?key=' + this.config.apiKey;
  //   for (var key in params) {
  //     url += '&' + key + '=' + params[key];
  //   }
  //   Log.info(url);
  //
  //   var self = this;
  //   var retry = true;
  //
  //   var tpgRequest = new XMLHttpRequest();
  //   tpgRequest.open("GET", url, true);
  //   /*tpgRequest.setRequestHeader('Access-Control-Allow-Headers', '*');
  //   tpgRequest.setRequestHeader('Access-Control-Allow-Origin',  '*');*/
  //   tpgRequest.onreadystatechange = function() {
  //     if (this.readyState === 4) {
  //       if (this.status === 200) {
  //         //self.processWeather(JSON.parse(this.response));
  //         Log.info('Query returned');
  //         Log.info(JSON.parse(this.response));
  //       } else if (this.status === 401) {
  //         self.config.appKey = "";
  //         self.updateDom(self.config.animationSpeed);
  //
  //         Log.error(self.name + ": Incorrect AppKey.");
  //         retry = false;
  //       } else {
  //         Log.error(self.name + ": Could not load TPG data.");
  //       }
  //
  //       if (retry) {
  //         self.scheduleUpdate((self.loaded) ? -1 : self.config.retryDelay);
  //       }
  //     }
  //   };
  //   tpgRequest.send();
  // }

});
