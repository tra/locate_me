/**
* A hack inspired by protolicious to retrieve and execute
* the JavaScript functions that MaxMind's API delivers.
* A kind of JSONP/ScriptP which unfortunately clutters the root namespace...
*
*/
(function(){
  // inspired by protolicious, http://github.com/kangax/protolicious/blob/master/get_json.js
  var id = 0, head = $$('head')[0], global = this;
  
  global.getMaxMindFunctions = function(url, callback) {
    var script = document.createElement('script'), token = '__jsonp' + id;
    script.src = url;
    script.onload = function() {
      script.remove();
      script = null;
      callback();
    };
    head.appendChild(script);
    id++;
  };

  // from: http://github.com/kangax/protolicious/blob/master/get_json.js
  global.getJSONP = function(url, callback) {
    var script = document.createElement('script'), token = '__jsonp' + id;
    global[token] = callback;
    script.src = url.replace(/\?(&|$)/, '__jsonp' + id + '$1');
    script.onload = function() {
      script.remove();
      script = null;
      delete global[token];
    };
    head.appendChild(script);
    id++;
  }
  
})();


/**
* A hack when no console.log() is available (e.g. no Firebug)
*
*/
try { console.log('init console... done'); } catch(e) { console = { log: function() {} } }


/**
* MorizGmbH_LocateMe_Result wraps the results provided
* by each geolocation service into a structured format-
*
*/
var MorizGmbH_LocateMe_Result = Class.create({
  initialize: function(provider) {
    this.provider  = provider;
    this.timestamp = "";
    this.latitude  = "";
    this.longitude = "";
    this.success   = false; // currently not really used. but please check for beeing true.
  }
});


/**
* MorizGmbH_LocateMe_ProviderBase is a base class
* inherited by each geolocation service class.
*
*/
var MorizGmbH_LocateMe_ProviderBase = Class.create({
  initialize: function(options) {
    console.log("initialize called")
    this.name    = "";
    this.errors  = 0;
    this.options = options;
    this.set_defaults(options);
  },
  set_defaults: function() {
    return false;
  },
  available: function() {
    return false;
  },
  locate: function() {
    return false;
  },
  handle_result: function() {
    return false;
  },
  handle_error: function() {
    return false;
  }
});


/**
* MorizGmbH_LocateMe_ProviderLoki 
* Implements Loki.com 
*
*/
var MorizGmbH_LocateMe_ProviderLoki = Class.create(MorizGmbH_LocateMe_ProviderBase, {
  
  set_defaults: function() {
    this.name = "Loki";
  },
  available: function(options) {
    var loki = false;

    if ((typeof LokiAPI != 'undefined') && LokiAPI.isInstalled() && options['loki_key'] != false) {
      loki = true;
    }

    return loki;
  },
  locate: function() {
    console.log("Loki::locate, key:" + options['loki_key']);
    try {
      var loki = LokiAPI();
      loki.onSuccess = this.handle_result;
      loki.onFailure = this.handle_error;
      loki.setKey(options['loki_key']);
      loki.requestLocation(true, loki.NO_STREET_ADDRESS_LOOKUP);
    } catch(e) {
      this.handle_error(e);
    }
  },
  handle_result: function(position) {
    console.log("Loki::handle_result");

    var result = new MorizGmbH_LocateMe_Result('Loki');
    result.timestamp = (new Date).getTime();
    result.latitude  = position['latitude'];
    result.longitude = position['longitude'];
    result.success   = true;

    MorizGmbH_LocateMe.add_result(result);
  },
  handle_error: function(error) {
    console.log("Loki::handle_error");
    console.log(error);
    MorizGmbH_LocateMe.errors++;

    // # 1001 - User denied location request
    if (error == 1001) {
      MorizGmbH_LocateMe.user_abort = true;
    }
  }
});


/**
* MorizGmbH_LocateMe_ProviderGears 
* Implements Google Gears/Google Chrome
*
*/
var MorizGmbH_LocateMe_ProviderGears = Class.create(MorizGmbH_LocateMe_ProviderBase, {
  set_defaults: function(options) {
    this.name = "Gears";
  },
  available: function() {
    var gears = false;

    if (window.google && google.gears) {
      gears = true;
    }

    return gears;
  },
  locate: function() {
    console.log("Gears::locate");
    try {
      var geo = google.gears.factory.create('beta.geolocation');
      geo.getCurrentPosition(this.handle_result, this.handle_error, this.options['gears_options']);
    } catch(e) {
      this.handle_error(e);
    }
  },
  handle_result: function(position) {
    console.log("Gears::handle_result");

    var result = new MorizGmbH_LocateMe_Result('Gears');
    result.timestamp = (new Date).getTime();
    result.latitude  = position['coords']['latitude'];
    result.longitude = position['coords']['longitude'];
    result.success   = true;

    MorizGmbH_LocateMe.add_result(result);
  },
  handle_error: function(error) {
    console.log("Gears::handle_error");
    console.log(error);
    MorizGmbH_LocateMe.errors++;
  }
});


/**
* MorizGmbH_LocateMe_ProviderW3C 
*
* Implements:
*   - W3C Draft
*   - Mozilla Geode (3.0.x, 3.5.x)
*   - Apple Mobile Safari 3.0 Beta (iPhone/iPod touch)
*   - Opera 10 alpha (Geo-enabled build, only Windows)
*
*/
var MorizGmbH_LocateMe_ProviderW3C = Class.create(MorizGmbH_LocateMe_ProviderBase, {
  set_defaults: function(options) {
    this.name = "W3C";
  },
  available: function() {
    var result = false;

    if (typeof navigator.geolocation != 'undefined') {
      result = true;
    }

    return result;
  },
  locate: function() {
    console.log("W3C::locate");
    try {
      navigator.geolocation.getCurrentPosition(this.handle_result, this.handle_error);
    } catch(e) {
      this.handle_error(e);
    }
  },
  handle_result: function(position) {
    console.log("W3C::handle_result");

    var result = new MorizGmbH_LocateMe_Result('W3C');
    result.timestamp = (new Date).getTime();
    result.success   = true;

    if (typeof position['coords'] != 'undefined') {
      result.latitude  = position['coords']['latitude'];
      result.longitude = position['coords']['longitude'];
    } else {
      result.latitude  = position['latitude'];
      result.longitude = position['longitude'];
    }

    MorizGmbH_LocateMe.add_result(result);
  },
  handle_error: function(error) {
    console.log("W3C::handle_error");
    console.log(error);
    MorizGmbH_LocateMe.errors++;
  }
});


/**
* MorizGmbH_LocateMe_ProviderMaxMind 
*
* Implements MaxMind.com JavaScript Webservice for an IP based
* less accurate geolocation.
*
* see:
*   - http://www.kevinleary.net/smart-forms-geoip-location/
*   - http://www.maxmind.com/app/javascript_city
*/
var MorizGmbH_LocateMe_ProviderMaxMind = Class.create(MorizGmbH_LocateMe_ProviderBase, {
  set_defaults: function(options) {
    this.name = "MaxMind";
  },
  available: function() {
    var result = true;
    return result;
  },
  locate: function() {
    var self = this;
    console.log("MaxMind::locate");
    try {
      var url = "http://j.maxmind.com/app/geoip.js";
      getMaxMindFunctions(url,
        function(){
          self.handle_result();
        }
      );
    } catch(e) {
      this.handle_error(e);
    }
  },
  handle_result: function() {
    console.log("MaxMind::handle_result");

    var result = new MorizGmbH_LocateMe_Result('MaxMind');
    result.timestamp = (new Date).getTime();
    result.success   = true;

    result.latitude  = parseFloat(geoip_latitude());
    result.longitude = parseFloat(geoip_longitude());

    MorizGmbH_LocateMe.add_result(result);
  },
  handle_error: function(error) {
    console.log("MaxMind::handle_error");
    console.log(error);
    MorizGmbH_LocateMe.errors++;
  }
});

/**
* MorizGmbH_LocateMe_ProviderIPLocationTools
*
* see:
*   - http://iplocationtools.com/ip_location_api.php
*   - http://jquery-howto.blogspot.com/2009/04/get-geographical-location-geolocation.html
*/
var MorizGmbH_LocateMe_ProviderIPLocationTools = Class.create(MorizGmbH_LocateMe_ProviderBase, {
  set_defaults: function(options) {
    this.name = "IPLocationTools";
  },
  available: function() {
    var result = true;
    return result;
  },
  locate: function() {
    var self = this;
    console.log("IPLocationTools::locate");
    try {
      var url = "http://iplocationtools.com/ip_query.php?output=json&callback=?";
      getJSONP(url,
        function(data){
          self.handle_result(data);
        }
      );
    } catch(e) {
      this.handle_error(e);
    }
  },
  handle_result: function(data) {
    console.log("IPLocationTools::handle_result");

    var result = new MorizGmbH_LocateMe_Result('IPLocationTools');
    result.timestamp = (new Date).getTime();
    result.success   = true;

    result.latitude  = parseFloat(data.Latitude);
    result.longitude = parseFloat(data.Longitude);
  
    MorizGmbH_LocateMe.add_result(result);
  },
  handle_error: function(error) {
    console.log("MaxMind::handle_error");
    console.log(error);
    MorizGmbH_LocateMe.errors++;
  }
});




/**
* MorizGmbH_LocateMe_Klass 
*
* The main class that handles the providers
*
*/
var MorizGmbH_LocateMe_Klass = Class.create({
  initialize: function(user_options) {

    this.defaults = {
      'loki_key': false,
      'gears_options': {}
    };

    this.options = this.mergeOptions(this.defaults, user_options);

    // convenient shortcuts
    this.provider_shortcuts = new Hash();
    this.provider_shortcuts.set('W3C',             'MorizGmbH_LocateMe_ProviderW3C');
    this.provider_shortcuts.set('Gears',           'MorizGmbH_LocateMe_ProviderGears');
    this.provider_shortcuts.set('Loki',            'MorizGmbH_LocateMe_ProviderLoki');
    this.provider_shortcuts.set('MaxMind',         'MorizGmbH_LocateMe_ProviderMaxMind');
    this.provider_shortcuts.set('IPLocationTools', 'MorizGmbH_LocateMe_ProviderIPLocationTools');
    
    // sorting = priority!
    this.selected_providers = [ 'W3C', 'Gears', 'Loki', 'IPLocationTools', 'MaxMind' ];
    this.available_methods  = new Hash();
    
    this.results = new Array();
    this.errors     = 0;
    this.successes  = 0;
    this.user_abort = false;
  },

  mergeOptions: function(def, custom) {
    var result = def;

    for (var key in custom) {
      result[key] = custom[key];
    }

    return result;  
  },

  set_callback: function(callback) {
    this.callback = callback;
  },
  
  set_options: function(user_options) {
    this.options = this.mergeOptions(this.options, user_options);
  },

  locate: function(callback) {
    this.set_callback(callback);
    this.check_available_geolocation_methods();
    this.get_location();
  },

  add_result: function(result) {
    this.results.push(result);
    this.successes++;
    this.callback(result);
  },

  check_available_geolocation_methods: function() {
    var self = this; 
    
    // reset
    this.available_methods = new Hash();

    this.selected_providers.each(function(provider_shortcut) {
      console.log("provider_shortcut: " + provider_shortcut);
      var provider = eval ("new " + self.provider_shortcuts.get(provider_shortcut) + "(self.options);");

      if (provider.available(self.options)) {
        console.log("Available: " + provider_shortcut);
        self.available_methods.set(provider_shortcut, provider);
      } 

    });
  },
  get_location: function() {
    var self = this;
    this.available_methods.each(function(provider) {
      var provider_key = provider[0];
      var provider     = provider[1];

      if (self.user_abort == true) { 
        console.log("user abort")
        return; 
      }

      try {
        provider.locate(self.options);
      } catch(e) {
        console.log(e);
      }
    });  
  }

});


var MorizGmbH_LocateMe = new MorizGmbH_LocateMe_Klass();

/* 

Example:
========

var LocateMe_callback = function(result) {
  alert("got result! provider: " + result.provider + ", lat: " + result.latitude + ", lng: " + result.longitude);
}
var options = { 'loki_key' : 'localhost' };
MorizGmbH_LocateMe.set_options(options);

MorizGmbH_LocateMe.selected_providers = ['Loki', 'MaxMind'];
MorizGmbH_LocateMe.locate(LocateMe_callback);

*/