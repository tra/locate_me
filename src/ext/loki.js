/*  Loki Javascript API
 *  Ryan Sarver <rsarver@skyhookwireless.com>
 *
 *  This is a helper script to help you detect and gracefully handle
 *  users with Loki Plugin installed
 *
/*--------------------------------------------------------------------------*/

/////////////////////////////////////////////////////////////////////////////////////////
// Version
/////////////////////////////////////////////////////////////////////////////////////////

LokiPlugin.availableVersion = "2.7.2.18";
LokiPlugin.scriptRevision = "2";

/////////////////////////////////////////////////////////////////////////////////////////
// Loki API wrapper
/////////////////////////////////////////////////////////////////////////////////////////

function LokiAPI()
{
    return Try.these(
                     function() {return new LokiPlugin()},
                     function() {return new LokiNull()}
                    ) || false;
}

LokiAPI.isInstalled = function()
{
    return LokiPlugin.isInstalled(true);
}

/////////////////////////////////////////////////////////////////////////////////////////
// LokiPlugin class, common parts
/////////////////////////////////////////////////////////////////////////////////////////

function LokiPlugin()
{
    if (LokiPlugin.timer)
        clearTimeout(LokiPlugin.timer);

    LokiPlugin.attemptedInstall = false;
    LokiPlugin.installFailed = false;
    LokiPlugin.upgradeStarted = false;
    LokiPlugin.activex = null;

    if (LokiPlugin.isInstalled(false))
        LokiPlugin.initPlugin();
    else
        this.tryToInstallPlugin();
}

LokiPlugin.isInstalled = function(silent)
{
    switch (BrowserDetect.browser)
    {
        case "Explorer":
            return LokiPlugin.isInstalled_IE(silent);

        case "Firefox":
            {
                try
                {
                    var lokixpcom = new Loki();
                    if (lokixpcom)
                    {
                        LokiPlugin.xpcom = lokixpcom;
                        return true;
                    }
                } catch (e) {}
            }
            /* FALLTHROUGH */
        case "Opera":
        case "Safari":
            return LokiPlugin.isInstalled_NPAPI(silent);

        default:
            return false;
    }
}

LokiPlugin.initPlugin = function()
{
    //If LokiPlugin.xpcom is set, then xpcom is installed, inited and should be used
    if (LokiPlugin.xpcom != null)
        return;

    switch (BrowserDetect.browser)
    {
        case "Explorer":
            LokiPlugin.init_IE();
            break;

        case "Firefox":
        case "Opera":
        case "Safari":
            LokiPlugin.init_NPAPI();
            break;
    }
}

LokiPlugin.checkDeprecatedVersion = function(description)
{
    // Not all browsers reloads description information when plugin binary was changed. So upgradeCompletedSuccessfull is required
    if (LokiPlugin.upgradeCompletedSuccessfull)
        return false;

    if (!LokiPlugin.upgradeCancelled && (this.checkVersionOnServer(description) > 0))
    {
        if (LokiPlugin.upgradeStarted)
            return true;
        LokiPlugin.upgradeStarted = true;

        if (confirm("Newer version of Loki Plugin available. Do you wish to install it?"))
            return true;
        else
            LokiPlugin.upgradeCancelled = true;
    }

    return false;
}

LokiPlugin.checkVersionOnServer = function(description)
{
    // Wrong description attribute - probably old version
    if (description == undefined || description.indexOf("v.") == -1)
        return true;

    actualVersion = description.substring(description.indexOf("v.") + 2);

    if (compareVersions(LokiPlugin.availableVersion, actualVersion) > 0)
        return true;

    return false;
}

LokiPlugin.prototype.browserSupported = function()
{
    // Here is complete list of well supported platforms and browsers
    // TODO add Chrome/Konqueror/Flock support

    if ((BrowserDetect.OS != "Windows" &&
         BrowserDetect.OS != "Mac" &&
         BrowserDetect.OS != "Linux") ||
        (BrowserDetect.browser != "Explorer" &&
         BrowserDetect.browser != "Firefox" && 
         BrowserDetect.browser != "Safari" &&
         BrowserDetect.browser != "Opera"))
    {
        return false;
    }

    return true;
}

LokiPlugin.prototype.requestLocation = function(latlon, addressLookup, retries)
{
    this.requestLocationBy(false, latlon, addressLookup, retries);
}

LokiPlugin.prototype.requestIPLocation = function(latlon, addressLookup, retries)
{
    this.requestLocationBy(true, latlon, addressLookup, retries);
}

LokiPlugin.prototype.requestLocationBy = function(IP, latlon, addressLookup, retries)
{
    if (!this.browserSupported())
    {
        if (this.onFailure)
            this.onFailureProxy(LokiPlugin.returnCodes["WPS_ERROR_PLUGIN_BROWSER_NOT_SUPPORTED"]);
        return;
    }

    if (retries == undefined)
        retries = 0;
    if (latlon == undefined)
        latlon = false;
    if (addressLookup == undefined)
        addressLookup = this.NO_STREET_ADDRESS_LOOKUP;

    if (retries >= 600 || this.installFailed)
    {
        return;
    }

    if (    LokiPlugin.activex == null
        && (LokiPlugin.plugin == undefined
               || LokiPlugin.plugin["asynchronousRequestLocation"] == undefined)
        &&  LokiPlugin.xpcom == null)
    {
        if (LokiPlugin.isInstalled(false))
        {
            LokiPlugin.initPlugin();
            retries++;
        }
        else if (this.attemptedInstall)
            retries++;

        var self = this;

        if (LokiPlugin.timer)
            clearTimeout(LokiPlugin.timer);
        LokiPlugin.timer = setTimeout(function(){self.requestLocationBy(IP, latlon, addressLookup, retries);}, 300);
        return;
    }

    if (true == LokiPlugin.waitingRet) return;
    LokiPlugin.waitingRet = true;
    
    if (LokiPlugin.xpcom != null)
        this.runRequestLocation_XPCOM(IP, latlon, addressLookup);
    else
    if (BrowserDetect.browser == "Explorer")
        this.runRequestLocation_IE(IP, latlon, addressLookup);
    else
        this.runRequestLocation_NPAPI(IP, latlon, addressLookup);
}

LokiPlugin.prototype.onFailureProxy = function(errcode)
{
    LokiPlugin.waitingRet = false;

    if (this.onFailure != undefined)
        this.onFailure(errcode, LokiPlugin.returnMessages[errcode]);
    // Workaround for IE
    else if (LokiPlugin.lastOnFailure != undefined)
        LokiPlugin.lastOnFailure(errcode, LokiPlugin.returnMessages[errcode]);
}

LokiPlugin.prototype.onSuccessProxy = function(location)
{
    LokiPlugin.waitingRet = false;
    
    if (this.onSuccess != undefined)
        this.onSuccess(location);
    // Workaround for IE
    else if (LokiPlugin.lastOnSuccess != undefined)
        LokiPlugin.lastOnSuccess(location);
}


/////////////////////////////////////////////////////////////////////////////////////////
// LokiPlugin class, Internet Explorer specific parts
/////////////////////////////////////////////////////////////////////////////////////////

LokiPlugin.isInstalled_IE = function(silent)
{
    if (LokiPlugin.toolbarDetected)
        return true;

    var loki;

    if (LokiPlugin.activex != null)
        loki = LokiPlugin.activex;
    else
    {
        try
        {
            loki = new ActiveXObject("Loki.LocationFinder.1");
        }
        catch (err)
        {
            return false;
        }

        if (!loki)
            return false;
    }

    if (!silent && this.checkDeprecatedVersion(loki.description))
        return false;

    LokiAPI.pluginDescription = loki.description;

    return true;
}

LokiPlugin.init_IE = function()
{
    LokiPlugin.activex = new ActiveXObject("Loki.LocationFinder.1");
}


LokiPlugin.prototype.runRequestLocation_XPCOM = function(IP, latlon, addressLookup)
{
    if (IP)
    {
        this.onFailureProxy(LokiPlugin.returnCodes["WPS_ERROR_FEATURE_NOT_SUPPORTED"]);
        return;
    }

    LokiPlugin.xpcom.onSuccess = this.onSuccessProxy;
    LokiPlugin.xpcom.onFailure = this.onFailureProxy;
    LokiPlugin.lastOnFailure = this.onFailure;
    LokiPlugin.lastOnSuccess = this.onSuccess;

    LokiPlugin.xpcom.setKey(this.key);
    
    try
    {
        LokiPlugin.xpcom.requestLocation(latlon, addressLookup);
    } catch (e)
    {
        this.onFailureProxy(LokiPlugin.returnCodes["WPS_ERROR_FEATURE_NOT_SUPPORTED"]);
    }
}

LokiPlugin.prototype.runRequestLocation_IE = function(IP, latlon, addressLookup)
{
    LokiPlugin.activex.onSuccess = this.onSuccessProxy;
    LokiPlugin.activex.onFailure = this.onFailureProxy;
    LokiPlugin.lastOnFailure = this.onFailure;
    LokiPlugin.lastOnSuccess = this.onSuccess;

    LokiPlugin.activex.setKey(this.key);
    
    try
    {
        if (IP)
            LokiPlugin.activex.requestIPLocation(latlon, addressLookup);
        else
            LokiPlugin.activex.requestLocation(latlon, addressLookup);
    } catch (e)
    {
        this.onFailureProxy(LokiPlugin.returnCodes["WPS_ERROR_FEATURE_NOT_SUPPORTED"]);
    }
}

/////////////////////////////////////////////////////////////////////////////////////////
// LokiPlugin class, NPAPI specific parts
/////////////////////////////////////////////////////////////////////////////////////////

LokiPlugin.isInstalled_NPAPI = function(silent)
{
    var deprecatedVersionIdx = -1;

    navigator.plugins.refresh(false);
    for (var i = 0; i < navigator.plugins.length; ++i)
    {
        if (navigator.plugins[i] == undefined)
            continue;

        if (navigator.plugins[i].name == "Loki Plugin")
        {
            if (!silent && this.checkDeprecatedVersion(navigator.plugins[i].description))
                return false;

            LokiAPI.pluginDescription = navigator.plugins[i].description;
            return true;
        } 

        if (navigator.plugins[i].name == "FindMe Plugin" ||
            navigator.plugins[i].name == "Find Me Plugin")
        {
            deprecatedVersionIdx = i;
        }

    }

    if (-1 != deprecatedVersionIdx)
    {
        if (!silent && this.checkDeprecatedVersion(navigator.plugins[deprecatedVersionIdx].description))
            return false;

        LokiAPI.pluginDescription = navigator.plugins[i].description;
        return true;
    }

    return false;
}

LokiPlugin.init_NPAPI = function()
{
    if (!LokiPlugin.isRunning)
    {
        var pluginAttributes =
        {
            id     : "__lokiPlugin",
            width  : "1",
            height : "1",
            type   : "application/x-loki"
        };

        var pluginDom = document.createElement("object");
        for (var x in pluginAttributes)
        {
            pluginDom.setAttribute(x, pluginAttributes[x]);
        }

        document.getElementsByTagName('body').item(0).appendChild(pluginDom);

        LokiPlugin.plugin = pluginDom;
        LokiPlugin.isRunning = true;
    }
}

LokiPlugin.prototype.runRequestLocation_NPAPI = function(IP, latlon, addressLookup)
{
    var self = this;
    setTimeout(function(){self.runRequestLocation_NPAPI_async(IP, latlon, addressLookup);}, 100);
}

LokiPlugin.prototype.runRequestLocation_NPAPI_async = function(IP, latlon, addressLookup)
{
    var self = this;
    if (IP)
        LokiPlugin.plugin.asynchronousRequestIPLocation(this.key, latlon, addressLookup);
    else
        LokiPlugin.plugin.asynchronousRequestLocation(this.key, latlon, addressLookup);
  
    setTimeout(function(){self.tickNpapiXHR();}, 100);
}

LokiPlugin.prototype.tickNpapiXHR = function()
{
    var location = LokiPlugin.plugin.tickRunHttpRequest();

    if (!location || location.returnCode == undefined)
    {
        var self = this;
        setTimeout(function(){self.tickNpapiXHR();}, 50);
        return;
    }

    if (location.returnCode != LokiPlugin.returnCodes["WPS_OK"])
    {
        this.onFailureProxy(location.returnCode);
        return;
    }

    this.onSuccessProxy(location);
}

LokiPlugin.prototype.setKey = function(key /*string*/)
{
    if (key == undefined || key == null)
        this.key = "";
    else
        this.key = key;
}

/////////////////////////////////////////////////////////////////////////////////////////
// Install Plugin staff
/////////////////////////////////////////////////////////////////////////////////////////


LokiPlugin.prototype.tryToInstallPlugin = function()
{
    if (this.attemptedInstall)
        return;

    this.attemptedInstall = true;
    if (BrowserDetect.javaAvail)
    {
        if (LokiAPI_PreloadNullapplet && !LokiPlugin.isInstalled(true))
        {
            if (  BrowserDetect.javaWaitingConfirmation &&
                ( BrowserDetect.browser == "Explorer" || 
                 (BrowserDetect.browser == "Safari" && BrowserDetect.OS == "Windows") ||
                 (BrowserDetect.browser == "Firefox" && LokiPlugin.javaPluginDescription.indexOf('1.4.') != -1)
                )
               )
            {
                // Internet Explorer and Safari requires confirmation that java is available. callback from nullapplet used
                var nullappletUptime = (new Date()).getTime() - BrowserDetect.javaWaitingConfirmationSince;
                if (nullappletUptime < LokiPlugin.fallbackToNativeTimeout)
                {
                    LokiPlugin.nullappletShouldRunInstaller = true;
                    setTimeout(fallbackToNativeInstaller, LokiPlugin.fallbackToNativeTimeout - nullappletUptime);
                } 
                else
                {
                    fallbackToNativeInstaller();
                }
            }
            else
            {
                LokiPlugin.startInstallApplet();
            }
        }
        else
        {
            if ( BrowserDetect.browser == "Explorer" || 
                (BrowserDetect.browser == "Safari" && BrowserDetect.OS == "Windows") ||
                (BrowserDetect.browser == "Firefox" && LokiPlugin.javaPluginDescription.indexOf('1.4.') != -1)
               )
            {
                //Internet Explorer and Safari requires confirmation that java is available. callback from nullapplet used
                LokiPlugin.nullappletShouldRunInstaller = true;
                LokiPlugin.runNullapplet();
                setTimeout(fallbackToNativeInstaller, LokiPlugin.fallbackToNativeTimeout);
            }
            else
            {
                LokiPlugin.startInstallApplet();
            }
        }
    }
    else
    {
        LokiPlugin.downloadNativeInstaller();
    }
}

LokiPlugin.downloadNativeInstaller = function()
{
    switch(BrowserDetect.OS)
    {
        case "Windows":
            if (BrowserDetect.browser == "Explorer")
            {
                if (window.XMLHttpRequest) 
                {
                    // IE 7
                    document.location.href = LokiPlugin.globalURLPrefix + "loki_activex.exe";
                } else 
                {
                    // IE6
                    window.open(LokiPlugin.globalURLPrefix + "loki_activex.exe", "download"); 
                }
            }
            else
                document.location.href = LokiPlugin.globalURLPrefix + "loki_setup.exe";
            break;

        case "Mac":
                document.location.href = LokiPlugin.globalURLPrefix + "LokiPlugin.zip";
            break;

        case "Linux":
                document.location.href = LokiPlugin.globalURLPrefix + "LokiPlugin_Installer.sh";
            break;
    }
}

function appletInstallationSuccessfull()
{
    LokiPlugin.upgradeCompletedSuccessfull = true;
}

function fallbackToNativeInstaller()
{
    if (BrowserDetect.javaWaitingConfirmation)
    {
        BrowserDetect.javaAvail = false;
        LokiPlugin.nullappletShouldRunInstaller = false;
        LokiPlugin.downloadNativeInstaller();
    }
}

function appletInstallationFailed()
{
    LokiPlugin.downloadNativeInstaller();
}

LokiPlugin.startInstallApplet = function()
{
    var appletDiv = document.createElement("div");
    var codebase_par = LokiPlugin.useGlobalURLs ?  '<PARAM NAME="archive" VALUE="' + LokiPlugin.globalURLPrefix + 'LokiApplet.jar"/>' : '';

    document.getElementsByTagName('body').item(0).appendChild(appletDiv);

    var globalUrlParameter = LokiPlugin.useGlobalURLs ?
                                 '<PARAM NAME="globalUrlPrexif" VALUE="' + LokiPlugin.globalURLPrefix + '">'
                                 : '';

    if (BrowserDetect.browser == "Explorer")
        appletDiv.innerHTML = '<OBJECT id="LokiApplet" classid="clsid:8AD9C840-044E-11D1-B3E9-00805F499D93" WIDTH="0" HEIGHT="0">'
                              + codebase_par
                              + '<PARAM NAME="CODE" VALUE="LokiApplet.class"/>'
                              + globalUrlParameter
                              + '<PARAM NAME="scriptable" VALUE="true"/></OBJECT>';
    else
        appletDiv.innerHTML = '<object classid="java:LokiApplet.class" type="application/x-java-applet" code="LokiApplet.class" archive="' + LokiPlugin.globalURLPrefix + 'LokiApplet.jar" width=0 height=0><PARAM NAME="MAYSCRIPT" VALUE="true">'
                              + globalUrlParameter
                              + '</object>';


}


// installs the plugin as extension for Firefox
// currently not used
LokiPlugin.prototype.tryToInstallExtension = function()
{
    var self = this;
    var installCallback = function(url, status)
    {
        self.attemptedInstall = true;
        if (status == 0)
        {
            self.init();
        }
        else
        {
            self.installFailed = true;
        }
    }
    var install = function(retry)
    {
        var prompted =
            InstallTrigger.install(
                {
                    "Loki Plugin" :
                    {
                        URL : LokiPlugin.globalURLPrefix + "loki_plugin.xpi",
                        IconURL: "Loki_B.png"
                    }
                },
                installCallback
            );

        if (!prompted)
        {
            throw "LokiPlugin: failed to prompt user to install plugin.";
        }
    }
    install();
    return;
}

/////////////////////////////////////////////////////////////////////////////////////////
// Helper functions and clesses
/////////////////////////////////////////////////////////////////////////////////////////

function IsLokiToolbarInstalled()
{
    try
    {
        if (Try.these(function() {return new ActiveXObject("Loki.LokiButton.1")}) || false)
            return true;
        return false;
    } catch (e)
    {
        return false;
    }
}

// "Null" loki object to ultimately fall back to
function LokiNull(){}

LokiNull.prototype.setKey = function(){}
LokiNull.prototype.isInstalled = function(){ return false; }
LokiNull.prototype.requestLocation = function()
{
    if (this.onFailure != undefined)
        this.onFailureProxy(LokiPlugin.returnCodes["WPS_ERROR_PLUGIN_COULD_NOT_BE_INSTALLED"]);
}

LokiNull.prototype.requestIPLocation = function()
{
    if (this.onFailure != undefined)
        this.onFailureProxy(LokiPlugin.returnCodes["WPS_ERROR_PLUGIN_COULD_NOT_BE_INSTALLED"]);
}

// Borrowed from the Prototype Library
var Try = {
  these: function() {
    var returnValue;

    for (var i = 0; i < arguments.length; i++) {
      var lambda = arguments[i];
      try {
        returnValue = lambda();
        break;
      } catch (e) {}
    }

    return returnValue;
  }
}

// Returns 0 if equal, positive if version1 > version2, negative otherwise (1.2 and 1.2.3 are equal)
function compareVersions(version1, version2)
{
    versions1 = version1.split(".");
    versions2 = version2.split(".");

    for (i = 0; i < versions1.length && i < versions2.length; i++)
    {
        if (parseInt(versions1[i]) > parseInt(versions2[i]))
            return i+1;
        if (parseInt(versions1[i]) < parseInt(versions2[i]))
            return -(i+1);
    }
    return 0;
}

var BrowserDetect = {

    init: function ()
        {
        this.browser = this.searchString(this.dataBrowser) || "Unknown browser";

        this.version = this.searchVersion(navigator.userAgent)
                       || this.searchVersion(navigator.appVersion)
                       || "Unknown version";

        this.OS = this.searchString(this.dataOS) || "Unknown OS";

        if (this.browser == "Explorer")
            this.javaAvail = true;
        else if (this.browser == "Firefox" && this.version == 3)
            this.javaAvail = this.findJava();
        else if (this.browser == "Opera")
            this.javaAvail = navigator.javaEnabled();
        else
            this.javaAvail = this.findJava() && navigator.javaEnabled();

        this.javaWaitingConfirmation = true;
        this.javaWaitingConfirmationSince = (new Date()).getTime();
    },

    findJava: function ()
        {
        if (!navigator || !navigator.plugins)
            return true;

            navigator.plugins.refresh(false);
            for (var i = 0; i < navigator.plugins.length; ++i)
            {
                if (navigator.plugins[i] == undefined)
                    continue;
                if (navigator.plugins[i].name.indexOf('Java') != -1)
                {
                    LokiPlugin.javaPluginDescription = navigator.plugins[i].description;
                    return true;
                }
            }

            return false;
        },

    searchString: function (data)
    {
        for (var i = 0; i < data.length; i++)
        {
            var dataString = data[i].string;
            var dataProp = data[i].prop;
            this.versionSearchString = data[i].versionSearch || data[i].identity;
            if (dataString)
            {
                if (dataString.indexOf(data[i].subString) != -1)
                    return data[i].identity;
            }
            else if (dataProp)
                return data[i].identity;
        }
    },

    searchVersion: function (dataString)
    {
        var index = dataString.indexOf(this.versionSearchString);
        if (index == -1)
            return;

        return parseFloat(dataString.substring(index+this.versionSearchString.length+1));
    },

    dataBrowser: [
        {
            string: navigator.userAgent,
            subString: "MSIE",
            identity: "Explorer",
            versionSearch: "MSIE"
        },
        {
            string: navigator.userAgent,
            subString: "Firefox",
            identity: "Firefox"
        },
        {
            prop: window.opera,
            identity: "Opera"
        },
        {
            string: navigator.vendor,
            subString: "KDE",
            identity: "Konqueror"
        },
        {
            string: navigator.userAgent,
            subString: "OmniWeb",
            versionSearch: "OmniWeb/",
            identity: "OmniWeb"
        },
        {
            string: navigator.vendor,
            subString: "Apple",
            identity: "Safari"
        },
        {
            string: navigator.vendor,
            subString: "iCab",
            identity: "iCab"
        },
        {
            string: navigator.vendor,
            subString: "Camino",
            identity: "Camino"
        },
        {        // for newer Netscapes (6+)
            string: navigator.userAgent,
            subString: "Netscape",
            identity: "Netscape"
        },
        {
            string: navigator.userAgent,
            subString: "Gecko",
            identity: "Mozilla",
            versionSearch: "rv"
        },
        {         // for older Netscapes (4-)
            string: navigator.userAgent,
            subString: "Mozilla",
            identity: "Netscape",
            versionSearch: "Mozilla"
        }
    ],

    dataOS : [
        {
            string: navigator.platform,
            subString: "Win",
            identity: "Windows"
        },
        {
            string: navigator.platform,
            subString: "Mac",
            identity: "Mac"
        },
        {
            string: navigator.platform,
            subString: "Linux",
            identity: "Linux"
        }
    ]
};

/////////////////////////////////////////////////////////////////////////////////////////
// Initialization
/////////////////////////////////////////////////////////////////////////////////////////

LokiPlugin.javaPluginDescription = "";

BrowserDetect.init();

LokiPlugin.prototype.key = "beta";

LokiPlugin.prototype.NO_STREET_ADDRESS_LOOKUP = 0;
LokiPlugin.prototype.LIMITED_STREET_ADDRESS_LOOKUP = 1;
LokiPlugin.prototype.FULL_STREET_ADDRESS_LOOKUP = 2;

LokiPlugin.returnCodes = new Object();
LokiPlugin.returnCodes["WPS_OK"] = 0;
LokiPlugin.returnCodes["WPS_ERROR_SCANNER_NOT_FOUND"] = 1;
LokiPlugin.returnCodes["WPS_ERROR_WIFI_NOT_AVAILABLE"] = 2;
LokiPlugin.returnCodes["WPS_ERROR_NO_WIFI_IN_RANGE"] = 3;
LokiPlugin.returnCodes["WPS_ERROR_UNAUTHORIZED"] = 4;
LokiPlugin.returnCodes["WPS_ERROR_SERVER_UNAVAILABLE"] = 5;
LokiPlugin.returnCodes["WPS_ERROR_LOCATION_CANNOT_BE_DETERMINED"] = 6;
LokiPlugin.returnCodes["WPS_ERROR_PROXY_UNAUTHORIZED"] = 7;
LokiPlugin.returnCodes["WPS_ERROR_FILE_IO"] = 8;
LokiPlugin.returnCodes["WPS_ERROR_INVALID_FILE_FORMAT"] = 9;
LokiPlugin.returnCodes["WPS_ERROR_PLUGIN_COULD_NOT_BE_INSTALLED"] = 1000;
LokiPlugin.returnCodes["WPS_ERROR_PERMISSION_DENIED"] = 1001;
LokiPlugin.returnCodes["WPS_ERROR_PLUGIN_BROWSER_NOT_SUPPORTED"] = 1002;
LokiPlugin.returnCodes["WPS_ERROR_FEATURE_NOT_SUPPORTED"] = 1003;

LokiPlugin.returnMessages = new Object();
LokiPlugin.returnMessages[0] = "Successfull";
LokiPlugin.returnMessages[1] = "Wi-Fi Scanner was not found";
LokiPlugin.returnMessages[2] = "Wi-Fi is not available";
LokiPlugin.returnMessages[3] = "No Wi-Fi access points are in range";
LokiPlugin.returnMessages[4] = "Invalid application key, please contact the site owner";
LokiPlugin.returnMessages[5] = "Location server unavailable";
LokiPlugin.returnMessages[6] = "No Wi-Fi access points were recognized";
LokiPlugin.returnMessages[7] = "Proxy error";
LokiPlugin.returnMessages[8] = "A file I/O error was encountered";
LokiPlugin.returnMessages[9] = "Invalid file format";
LokiPlugin.returnMessages[1000] = "Plugin could not be installed";
LokiPlugin.returnMessages[1001] = "Permission denied";
LokiPlugin.returnMessages[1002] = "Browser is not supported";
LokiPlugin.returnMessages[1003] = "Feature is not supported by installed version of plugin";

LokiPlugin.fallbackToNativeTimeout = 10000;
LokiPlugin.xpcom = null;
LokiPlugin.activex = null;
LokiPlugin.isRunning = false;
LokiPlugin.timer = 0;
LokiPlugin.attemptedInstall = false;
LokiPlugin.installFailed = false;
LokiPlugin.upgradeCancelled = false;
LokiPlugin.upgradeStarted = false;
LokiPlugin.upgradeCompletedSuccessfull = false;
LokiPlugin.nullappletShouldRunInstaller = false;
LokiPlugin.waitingRet = false;

var LokiAPI_PreloadNullapplet;
var LokiAPI_FilesLocation;
if (LokiAPI_FilesLocation == undefined)
    LokiAPI_FilesLocation = "http://loki.com/plugin/files/";
if (LokiAPI_PreloadNullapplet == undefined)
    LokiAPI_PreloadNullapplet = false;

LokiPlugin.toolbarDetected = IsLokiToolbarInstalled();

LokiPlugin.useGlobalURLs = (LokiAPI_FilesLocation != undefined && LokiAPI_FilesLocation != "");
LokiPlugin.globalURLPrefix = LokiPlugin.useGlobalURLs ? LokiAPI_FilesLocation : "";

if (BrowserDetect.javaAvail && !LokiPlugin.isInstalled(true))
{
    if (LokiAPI_PreloadNullapplet)
    {
        // Nullapplet should be runned after scripts loads to be able to insert itself into dom
        setTimeout(function(){LokiPlugin.runNullapplet();}, 200);
    }
}

LokiPlugin.runNullapplet = function()
{
    var codebase = LokiPlugin.useGlobalURLs ?  'codebase="' + LokiPlugin.globalURLPrefix + '"' : '';
    var codebase_par = LokiPlugin.useGlobalURLs ?  '<PARAM NAME="CODEBASE" VALUE="' + LokiPlugin.globalURLPrefix + '"/>' : '';
    var appletDiv = document.createElement("div");

    document.getElementsByTagName('body').item(0).appendChild(appletDiv);

    if (!LokiAPI_PreloadNullapplet)
    {
        LokiPlugin.nullappletShouldRunInstaller = true;
    }
    
    BrowserDetect.javaWaitingConfirmationSince = (new Date()).getTime();

    if (BrowserDetect.browser == "Safari")
        appletDiv.innerHTML = '<object type="application/x-java-applet" code="nullapplet.class" ' + codebase + ' width=0 height=0><PARAM NAME="MAYSCRIPT" VALUE="true"><param name="JAVA_CODEBASE" value="' + LokiPlugin.globalURLPrefix + '"></object>';
    else if (BrowserDetect.browser == "Explorer")
        appletDiv.innerHTML = '<OBJECT id="nullapplet" classid="clsid:8AD9C840-044E-11D1-B3E9-00805F499D93" WIDTH="0" HEIGHT="0">' + codebase_par + '<PARAM NAME="CODE" VALUE="nullapplet.class"/><PARAM NAME="scriptable" VALUE="true"/></OBJECT>';
    else
        appletDiv.innerHTML = '<applet name="nullapplet" id="nullapplet" ' + codebase + ' code="nullapplet.class" width="0" height="0" mayscript=true><param name="mayscript" value="true"></applet>';

}

// Called from nullapplet to confirm that java available
function confirmJavaOK()
{
    BrowserDetect.javaWaitingConfirmation = false;
    if (LokiPlugin.nullappletShouldRunInstaller)
    {
        LokiPlugin.nullappletShouldRunInstaller = false;
        LokiPlugin.startInstallApplet();
    }
}
