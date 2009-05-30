Locate Me - Locate your users by using state of the art geolocation services.

Description:
    This JavaScript project allows you to geolocate the current user by using
    the upcoming W3C Geolocation API, Google Gears, Mozilla Geode, Skyhook 
    Wireless' Loki and finally MaxMind's IP-based geolocation webservice.
    
    The modular structure allows to write your own geo-provider class very
    easily - e.g. if you want to talk to some other JSON or xml based webservice.

Supported Methods and default order:
    'W3C', 'Gears', 'Loki', 'MaxMind'

Requirements:
    - Prototype 1.6.0.3 (other versions not tested)
    - Google Gears JavaScript (from gears.google.com or the bundled version from the ext directory)
    - Loki.com JavaScript (from loki.com or the bundled version from the ext directory)

Example:
    
    Example #1 - use all available methods
    
    // your callback method
    var LocateMe_callback = function(result) {
      alert("got result! provider: " + result.provider + ", lat: " + result.latitude + ", lng: " + result.longitude);
    }    
    
    // configure LOKI - get your API key from loki.com. REQUIRED for loki!
    var options = { 'loki_key' : 'domain.example.com' };
    
    // set your stuff
    MorizGmbH_LocateMe.set_options(options);
    
    // fire
    MorizGmbH_LocateMe.locate(LocateMe_callback);

    Example #2 - Use only W3C (if available):
    
    // your callback method
    var LocateMe_callback = function(result) {
      alert("got result! provider: " + result.provider + ", lat: " + result.latitude + ", lng: " + result.longitude);
    }
    
    // use only this provider(s). when not available no other provider is used!
    MorizGmbH_LocateMe.selected_providers = ['W3C'];
  
    MorizGmbH_LocateMe.locate(LocateMe_callback);

  
More information:
    http://dev.w3.org/geo/api/spec-source.html
    http://gears.google.com/
    http://www.loki.com/
    http://labs.mozilla.com/2008/10/introducing-geode/    
    
Author:
    Roland Moriz, rmoriz@gmail.com

Copyright:
    (C) 2009 Moriz GmbH - http://www.moriz.de/
    
    Parts:
      - (C) 2009 Google, Inc.
      
      - (C) 2009 Skyhook Wireless, Inc.
      
      - (C) Juriy Zaytsev (kangax) 
        protolicious is licensed under the terms of the MIT license 

License:
    LocateMe is licensed under the term of the MIT license
