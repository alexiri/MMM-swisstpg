Module.register('MMM-swisstpg', {
  // Default module config.
  defaults: {
    routes: {},
    // routes: {
    //   '8587057': [
    //     { 'line': '6', 'direction': 'Gen\u00e8ve, Plage', 'color': '008cbe' },
    //     { 'line': '9', 'direction': 'Th\u00f4nex, Belle-Terre Pl. Araire', 'color': 'e2001d' },
    //     { 'line': '10', 'direction': 'Gen\u00e8ve, Rive', 'color': '006e3d' },
    //   ],
    // },

    maxDepartures: 6,
    maxWaitTime: 30,
    useLineColors: true,
    disruptionsOnly: false,
    waitThreshold: 3,

    animationSpeed: 1000,
    updateInterval: 120 * 1000, // 120 seconds
    initialLoadDelay: 0, // 0 seconds delay
    retryDelay: 2500,

    apiBase: 'https://transport.opendata.ch',
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

    if (this.config.useLineColors) {
      var sheet = document.createElement('style');
      sheet.innerHTML = '.small_text { font-size: 0.8em; }';
      _.each(this.config.routes, function(route) {
        _.each(route, function(line) {
          if (line.color) sheet.innerHTML = sheet.innerHTML + '.line-' + line.line + ' td.line { background-color: #' + line.color + '} ';
        });
      });
      document.body.appendChild(sheet);
    }
    this.departures = {};

    this.loaded = false;
    this.update_timer = null;
    this.scheduleUpdate(this.config.initialLoadDelay);
  },

  scheduleUpdate: function(delay) {
    if (this.update_timer == -1) { return; }
    var nextLoad = this.config.updateInterval;
    if (typeof delay !== "undefined" && delay >= 0) {
      nextLoad = delay;
    }

    var self = this;
    this.update_timer = setTimeout(function() {

      for (var stop in self.config.routes) {
      Log.info('Send query for: ');
      Log.info(stop);
        self.sendQuery('stationboard', {
            'station': stop,
            'type': 'departure',
            'limit': 100,
        });
      }

    }, nextLoad);
    Log.info("Timer " + this.update_timer + " set for " + nextLoad);
  },

  suspend: function() {
    if (this.update_timer) {
      clearTimeout(this.update_timer);
    }
    this.update_timer = -1;
  },

  resume: function() {
    this.update_timer = null;
    this.scheduleUpdate(this.config.initialLoadDelay);
  },

  // Override dom generator.
  getDom: function() {
    var wrapper = document.createElement("div");

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

    if (this.config.disruptionsOnly) {
      return this.showDisruptions();
    } else {
      return this.showBusses();
    }
  },

  showBusses: function() {
    var template = `
    <table>
      <tr>
        <% _.each(departures, function(busses, stop){ %>
          <th class='large thin'><%- stop %></th>
        <% }); %>
      </tr>
      <tr>
        <% _.each(departures, function(busses, stop){ %>
          <td>
            <table class='departures'>
              <tr class='small_text'>
                <th class='line'><%= translate('line') %></th>
                <th class='direction'><%- translate('direction') %></th>
                <th class='wait'><%= translate('wait') %></th>
                <th></th>
              </tr>
              <% for (var d in busses) { %>
                <tr class='<%= config.useLineColors? 'line-'+busses[d].line.lineCode : 'line-bg' %> <%= busses[d].waitingTime <= config.waitThreshold? 'small_text' : '' %>'>
                  <td class='line'><%- busses[d].line.lineCode %></td>
                  <td class='direction'><%- busses[d].line.destinationName %></td>
                  <td class='wait'><%= busses[d].reliability !== 'F'? '~' : '' %><%- translate(busses[d].waitingTime) %></td>
                  <td class='icons'>
                    <% if (busses[d].waitingTime < 1) { %><img src='/MMM-swisstpg/icon_bus.png' height='20px' width='20px' class='bus'><% } %>
                  </td>
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
         name: this.name, // Need this to make translations work
         translate: this.translate,
         config: this.config,
         departures: this.departures,
       })
    );

    return $div[0];
  },

  showDisruptions: function() {
    var disruptions = _.flatten(_.map(this.departures, function(i, stop, departures){
      return _.map(departures[stop], function(departure) {
        return departure.disruptions;
      });
    }));

    var dis = {};
    _.each(disruptions, function(k) {
      if (k && !(k.disruptionCode in dis)) {
        dis[k.disruptionCode] = k;
      }
    });

    disruptions = _.sortBy(_.values(dis), 'timestamp').reverse();
    //Log.info('disruptions:');
    //Log.info(disruptions);

    var template = `
    <table>
      <% _.each(disruptions, function(d){ %>
        <tr>
          <td class='small nature align-left'><%- d.nature %></td>
          <td class='small place'><%- d.place %></td>
        <tr>
          <td class='xsmall consequence align-left' colspan='2'><%- d.consequence %></td>
        </tr>
      <% }); %>
    </table>
    `;

    var t = _.template(template);
    var $div = $(
      t({
        name: this.name, // Need this to make translations work
        translate: this.translate,
        config: this.config,
        disruptions: disruptions,
       })
    );

    return $div[0];
  },

  sendQuery: function(endpoint, params) {
    return this.sendSocketNotification(endpoint, {
      apiBase: this.config.apiBase,
      apiVersion: this.config.apiVersion,
      params: params
    });
  },

  socketNotificationReceived: function(notification, payload) {
    if (notification === 'QUERY_RESULT') {
      Log.info('swisstpg Query result: ' + payload.endpoint);
      Log.info(payload);
      Log.info(new Date());
      if (payload.endpoint === 'stationboard') {
        conf = this.config.routes[payload.result.station.id];
        this.departures[payload.result.station.name] = [];

        this.now = moment().unix();

        payload.result.stationboard.forEach(function(item) {
          // console.log(item.number, item.to, item.stop.prognosis.departure, item.stop);
          if (_.findWhere(conf, {line: item.number, direction: item.to}) == undefined) return;

          // console.log(item.number, item.stop.prognosis, moment(item.stop.prognosis.arrival).unix() - moment().unix());
          // console.log(" -> Inserting", moment(item.stop.prognosis.departure || item.stop.departure).unix(), this.now, moment(item.stop.prognosis.departure).unix() - this.now)
          this.departures[payload.result.station.name].push({
            line: {
              lineCode: item.number,
              destinationName: item.to,
            },
            waitingTime: Math.floor((moment(item.stop.prognosis.departure || item.stop.departure).unix() - this.now) / 60),
            reliability: (item.stop.prognosis.departure ? 'F': 'S'), // F: Forecast, S: Scheduled
            //disruptions: item.stop.prognosis.disruptions,
          });
        }, this);
        console.log("Departures", this.departures);
        this.loaded = true;
        this.scheduleUpdate();
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
