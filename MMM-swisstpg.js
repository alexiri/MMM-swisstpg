Module.register('MMM-swisstpg', {
  // Default module config.
  defaults: {
    text: "Hello World!"
  },

  getScripts: function() {
    return []
  },

  getStyles: function() {
    return [ this.file('css/MMM-swisstpg.css') ]
  },

  getTranslations: function() {
    return {
      en: 'translations/en.json',
      es: 'translations/es.json',
    }
  }, 

  // Override dom generator.
  getDom: function() {
    var wrapper = document.createElement("div");
    //wrapper.innerHTML = this.config.text;
    wrapper.innerHTML = this.translate('hello');
    return wrapper;
  }
});
