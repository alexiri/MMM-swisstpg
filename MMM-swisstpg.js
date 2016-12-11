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
    useLineColors: true,
    disruptionsOnly: false,
    waitThreshold: 3,

    animationSpeed: 1000,
    updateInterval: 12 * 10 * 1000, // 10 seconds
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

    if (this.config.useLineColors) {
      this.sendQuery('GetLinesColors');
    }
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
              <tr class='small'>
                <th class='line'><%= translate('line') %></th>
                <th class='direction'><%- translate('direction') %></th>
                <th class='wait'><%= translate('wait') %></th>
                <th></th>
              </tr>
              <% for (var d in busses) { %>
                <tr class='<%= config.useLineColors? 'line-'+busses[d].line.lineCode : 'line-bg' %> <%= busses[d].waitingTime <= config.waitThreshold? 'small' : '' %>'>
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
      if (!(k.disruptionCode in dis)) {
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
