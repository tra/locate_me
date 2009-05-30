/*  Locate Me, version 0.0.1
 *  (c) 2009 Roland Moriz
 *
 *  Locate Me is freely distributable under
 *  the terms of an MIT-style license.
 *  For details, see the web site: http://NOTE-ENTER-URL.com
 *
 *--------------------------------------------------------------------------*/

var LocateMe = {
  Version: '0.0.1',
};


function CMorizLocateMe(user_options){

  var defaults = {
                    'loki_key': false,
                    'gears_options': {},
                 };

  var options = mergeOptions(defaults, user_options);

  // sorting = priority!
  this.selected_methods  = ['Gears', 'Loki', 'W3C', 'hostip', 'MaxMind'];
  this.available_methods = {};

  var results = [];
  var success    = false;
  var user_abort = false;

  this.provider = {};

  // accessors
  this.user_abort = function() {
    return user_abort;
  };

  this.success = function() {
    return success;
  };

  this.results = function() {
    return results;
  };

  this.result = function() {
    return results[0];
  };

  //
  this.locate = function() {
    this.check_available_geolocation_methods();
    this.get_location();
  };

  // - determine available methods
  this.check_available_geolocation_methods = function() {
    for each (var method in this.selected_methods) {
      var result = false;
      // console.log("provider: " + method);
      // console.log("result: "   + this.provider[method].available(this.options));
      result = this.provider[method].available(options);
      this.available_methods[method] = result;
    };
  };

  // - trigger location request
  this.get_location = function() {
    for (var method in this.available_methods) {
      // FIXME multiple
      // if (success    != false) { break; }
      //if (user_abort == true)  { break; }

      if (this.available_methods[method] == false) { continue; }
      this.provider[method].locate(options);
    };
  }

  //
  // Google Gears (Chrome & plugins for various platforms)
  //
  this.provider.Gears = new function() {
    var provider = 'Gears';

    this.available = function() {
      var gears = false;

      if (window.google && google.gears) {
        gears = true;
      }
      return gears;
    };

    this.locate = function() {
      try {
        var geo = google.gears.factory.create('beta.geolocation');
        geo.getCurrentPosition(this.handle_result, this.handle_error, options['gears_options']);
      } catch(e) {
        this.handle_error(e);
      }
    };

    this.handle_result = function(position) {
      var result = [];
      result['provider']  = provider;
      result['timestamp'] = position['timestamp'];
      result['accuracy']  = position['accuracy'];
      result['latitude']  = position['coords']['latitude'];
      result['longitude'] = position['coords']['longitude'];
      results.push(result);
      success = true;
    };

    this.handle_error = function(positionError) {
      if (positionError.message) {
        if (positionError.message.match(/Page does not have permission to access location information using Google Gears/)) {
          user_abort = true;
        }
      }
    };

  };

  // Loki.com
  this.provider.Loki = new function() {
    var provider = 'Loki';

    this.available = function() {
      var loki = false;

      if ((typeof LokiAPI != 'undefined') && LokiAPI.isInstalled() && options['loki_key'] != false) {
        loki = true;
      }

      return loki;
    };

    this.locate = function() {
      try {
        var loki = LokiAPI();
        loki.onSuccess = this.handle_result;
        loki.onFailure = this.handle_error;
        loki.setKey(options['loki_key']);
        loki.requestLocation(true, loki.NO_STREET_ADDRESS_LOOKUP);
      } catch(e) {
        this.handle_error(e);
      }
    };

    this.handle_result = function(position) {
      var result = [];
      result['provider']  = provider;
      result['timestamp'] = (new Date).getTime();
      result['latitude']  = position['latitude'];
      result['longitude'] = position['longitude'];
      results.push(result);
      success = true;
    };

    this.handle_error = function(error, msg) {
      alert('An error has been encountered ('+error+'). '+msg);
      console.dir(positionError);
    };
  };


  // Geolocation API Specification
  // http://dev.w3.org/geo/api/spec-source.html
  //
  // Firefox 3.x & Geode Plugin
  // Firefox 3.5 & Geode HUD Plugin
  // iPhone OS 3.0 (beta)
  //
  this.provider.W3C = new function() {
    this.available = function() {
      var result = false;

      if (typeof navigator.geolocation != 'undefined') {
        result = true;
      }

      return result;
    };

    this.locate = function() {
    };

    this.handle_result = function() {
    };

    this.handle_error = function() {
    };
  };

  // IP lookup against hostip.info
  // => http://api.hostip.info/get_html.php?ip=85.181.90.143&position=true

  this.provider.hostip = new function() {
    this.available = function() {
      return false;
    };

    this.locate = function() {
    };

    this.handle_result = function() {
    };

    this.handle_error = function() {
    };
  };

  // IP lookup by MaxMind ajax
  // => http://www.kevinleary.net/smart-forms-geoip-location/
  // => http://www.maxmind.com/app/javascript_city
  this.provider.MaxMind = new function() {
    this.available = function() {
      return false;
    };

    this.locate = function() {
    };

    this.handle_result = function() {
    };

    this.handle_error = function() {
    };
  }




  function mergeOptions(def, custom) {
    var result = def;

    for (var key in custom) {
      result[key] = custom[key];
    }

    return result;
  };

};

var options = { 'loki_key' : 'localhost' };
var LocateMe = new CMorizLocateMe(options);
LocateMe.selected_methods  = ['Loki', 'W3C', 'hostip', 'MaxMind'];


//LocateMe.locate();
//console.dir(LocateMe.selected_methods);
//console.dir(LocateMe.available_methods);
//console.dir(LocateMe.options);


//
//
//
//
// $.fn.doLocalization = function() {
//   if (window.localize != true) { return; }
//
//   //console.log('geolocalization enabled!');
//
//   if (navigator && navigator.geolocation) {
//     $('#localization_method').append('HTML 5.0/W3C Geo API');
//     $(this).localizeWithHTML();
//   } else if (window.google && google.gears) {
//     $('#localization_method').append('Google Gears');
//     $(this).localizeWithGears();
//   } else if (LokiAPI && LokiAPI.isInstalled()) {
//       $('#localization_method').append('Loki (Skyhookwireless)');
//       $(this).localizeWithLoki();
//   } else {
//     $('#localization_method').html('Eine automatische Standortkennung war leider nicht möglich.')
//     $('#geohelper').show();
//     $('#manual_choice').show();
//     $(this).externalLinksAreExternal();
//     $('#url').focus();
//     $('#manual_form').submit(function() { window.location.href = '/' + $('#url').val(); return false;} )
//     $('#submit').click(function() { window.location.href = '/' + $('#url').val();  return false;} )
//   }
//
// }
//
// $.fn.getLocationName = function(lat, lng, type) {
//   $.post("/geo", { lat: lat, lng: lng, type: type }, function(data) {
//     if (data && data.city) {
//       window.location.href = '/' + data.city;
//     }
//   }, 'json');
// }
//
// $.fn.localizeWithGears = function() {
//   var geo = google.gears.factory.create('beta.geolocation');
//   geo.getCurrentPosition(GearsUpdatePosition);
// }
//
// function GearsUpdatePosition(position) {
//   $(this).getLocationName(position.latitude, position.longitude, 'Google Gears');
// }
//
// $.fn.localizeWithLoki = function() {
//   var loki = LokiAPI();
//   loki.onSuccess = function(location) { $.fn.getLocationName(location.latitude, location.longitude, 'Loki'); }
//   loki.onFailure = function(error) {};
//   loki.setKey('wetter.moriz.de/');
//   loki.requestLocation(true, loki.NO_STREET_ADDRESS_LOOKUP);
// }
//
// $.fn.localizeWithHTML = function() {
//   navigator.geolocation.getCurrentPosition(function(position) {
//     if (position.coords != undefined) {
//       $(this).getLocationName(position.coords.latitude, position.coords.longitude, 'HTML5 Geolocation API');
//     } else {
//       $(this).getLocationName(position.latitude, position.longitude, 'HTML5 Geolocation API');
//     }
//   });
// }
//