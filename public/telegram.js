(function () {
  var eventHandlers = {};
  var locationHash = "";
  try {
    locationHash = location.hash.toString();
  } catch (e) {}
  var initParams = urlParseHashParams(locationHash);
  var storedParams = sessionStorageGet("initParams");
  if (storedParams) {
    for (var key in storedParams) {
      if (typeof initParams[key] === "undefined") {
        initParams[key] = storedParams[key];
      }
    }
  }
  sessionStorageSet("initParams", initParams);
  var isIframe = false,
    iFrameStyle;
  try {
    isIframe = window.parent != null && window != window.parent;
    if (isIframe) {
      window.addEventListener("message", function (event) {
        if (event.source !== window.parent) return;
        try {
          var dataParsed = JSON.parse(event.data);
        } catch (e) {
          return;
        }
        if (!dataParsed || !dataParsed.eventType) {
          return;
        }
        if (dataParsed.eventType == "set_custom_style") {
          if (event.origin === "https://web.telegram.org") {
            iFrameStyle.innerHTML = dataParsed.eventData;
          }
        } else if (dataParsed.eventType == "reload_iframe") {
          try {
            window.parent.postMessage(
              JSON.stringify({ eventType: "iframe_will_reload" }),
              "*",
            );
          } catch (e) {}
          location.reload();
        } else {
          receiveEvent(dataParsed.eventType, dataParsed.eventData);
        }
      });
      iFrameStyle = document.createElement("style");
      document.head.appendChild(iFrameStyle);
      try {
        window.parent.postMessage(
          JSON.stringify({
            eventType: "iframe_ready",
            eventData: { reload_supported: true },
          }),
          "*",
        );
      } catch (e) {}
    }
  } catch (e) {}
  function urlSafeDecode(urlencoded) {
    try {
      urlencoded = urlencoded.replace(/\+/g, "%20");
      return decodeURIComponent(urlencoded);
    } catch (e) {
      return urlencoded;
    }
  }
  function urlParseHashParams(locationHash) {
    locationHash = locationHash.replace(/^#/, "");
    var params = {};
    if (!locationHash.length) {
      return params;
    }
    if (locationHash.indexOf("=") < 0 && locationHash.indexOf("?") < 0) {
      params._path = urlSafeDecode(locationHash);
      return params;
    }
    var qIndex = locationHash.indexOf("?");
    if (qIndex >= 0) {
      var pathParam = locationHash.substr(0, qIndex);
      params._path = urlSafeDecode(pathParam);
      locationHash = locationHash.substr(qIndex + 1);
    }
    var query_params = urlParseQueryString(locationHash);
    for (var k in query_params) {
      params[k] = query_params[k];
    }
    return params;
  }
  function urlParseQueryString(queryString) {
    var params = {};
    if (!queryString.length) {
      return params;
    }
    var queryStringParams = queryString.split("&");
    var i, param, paramName, paramValue;
    for (i = 0; i < queryStringParams.length; i++) {
      param = queryStringParams[i].split("=");
      paramName = urlSafeDecode(param[0]);
      paramValue = param[1] == null ? null : urlSafeDecode(param[1]);
      params[paramName] = paramValue;
    }
    return params;
  }
  function urlAppendHashParams(url, addHash) {
    var ind = url.indexOf("#");
    if (ind < 0) {
      return url + "#" + addHash;
    }
    var curHash = url.substr(ind + 1);
    if (curHash.indexOf("=") >= 0 || curHash.indexOf("?") >= 0) {
      return url + "&" + addHash;
    }
    if (curHash.length > 0) {
      return url + "?" + addHash;
    }
    return url + addHash;
  }
  function postEvent(eventType, callback, eventData) {
    if (!callback) {
      callback = function () {};
    }
    if (eventData === undefined) {
      eventData = "";
    }
    if (window.TelegramWebviewProxy !== undefined) {
      TelegramWebviewProxy.postEvent(eventType, JSON.stringify(eventData));
      callback();
    } else if (window.external && "notify" in window.external) {
      window.external.notify(
        JSON.stringify({ eventType: eventType, eventData: eventData }),
      );
      callback();
    } else if (isIframe) {
      try {
        var trustedTarget = "https://web.telegram.org";
        trustedTarget = "*";
        window.parent.postMessage(
          JSON.stringify({ eventType: eventType, eventData: eventData }),
          trustedTarget,
        );
        callback();
      } catch (e) {
        callback(e);
      }
    } else {
      callback({ notAvailable: true });
    }
  }
  function receiveEvent(eventType, eventData) {
    callEventCallbacks(eventType, function (callback) {
      callback(eventType, eventData);
    });
  }
  function callEventCallbacks(eventType, func) {
    var curEventHandlers = eventHandlers[eventType];
    if (curEventHandlers === undefined || !curEventHandlers.length) {
      return;
    }
    for (var i = 0; i < curEventHandlers.length; i++) {
      try {
        func(curEventHandlers[i]);
      } catch (e) {}
    }
  }
  function onEvent(eventType, callback) {
    if (eventHandlers[eventType] === undefined) {
      eventHandlers[eventType] = [];
    }
    var index = eventHandlers[eventType].indexOf(callback);
    if (index === -1) {
      eventHandlers[eventType].push(callback);
    }
  }
  function offEvent(eventType, callback) {
    if (eventHandlers[eventType] === undefined) {
      return;
    }
    var index = eventHandlers[eventType].indexOf(callback);
    if (index === -1) {
      return;
    }
    eventHandlers[eventType].splice(index, 1);
  }
  function openProtoUrl(url) {
    if (!url.match(/^(web\+)?tgb?:\/\/./)) {
      return false;
    }
    var useIframe = navigator.userAgent.match(/iOS|iPhone OS|iPhone|iPod|iPad/i)
      ? true
      : false;
    if (useIframe) {
      var iframeContEl =
        document.getElementById("tgme_frame_cont") || document.body;
      var iframeEl = document.createElement("iframe");
      iframeContEl.appendChild(iframeEl);
      var pageHidden = false;
      var enableHidden = function () {
        pageHidden = true;
      };
      window.addEventListener("pagehide", enableHidden, false);
      window.addEventListener("blur", enableHidden, false);
      if (iframeEl !== null) {
        iframeEl.src = url;
      }
      setTimeout(function () {
        if (!pageHidden) {
          window.location = url;
        }
        window.removeEventListener("pagehide", enableHidden, false);
        window.removeEventListener("blur", enableHidden, false);
      }, 2e3);
    } else {
      window.location = url;
    }
    return true;
  }
  function sessionStorageSet(key, value) {
    try {
      window.sessionStorage.setItem(
        "__telegram__" + key,
        JSON.stringify(value),
      );
      return true;
    } catch (e) {}
    return false;
  }
  function sessionStorageGet(key) {
    try {
      return JSON.parse(window.sessionStorage.getItem("__telegram__" + key));
    } catch (e) {}
    return null;
  }
  if (!window.Telegram) {
    window.Telegram = {};
  }
  window.Telegram.WebView = {
    initParams: initParams,
    isIframe: isIframe,
    onEvent: onEvent,
    offEvent: offEvent,
    postEvent: postEvent,
    receiveEvent: receiveEvent,
    callEventCallbacks: callEventCallbacks,
  };
  window.Telegram.Utils = {
    urlSafeDecode: urlSafeDecode,
    urlParseQueryString: urlParseQueryString,
    urlParseHashParams: urlParseHashParams,
    urlAppendHashParams: urlAppendHashParams,
    sessionStorageSet: sessionStorageSet,
    sessionStorageGet: sessionStorageGet,
  };
  window.TelegramGameProxy_receiveEvent = receiveEvent;
  window.TelegramGameProxy = { receiveEvent: receiveEvent };
})();
(function () {
  var Utils = window.Telegram.Utils;
  var WebView = window.Telegram.WebView;
  var initParams = WebView.initParams;
  var isIframe = WebView.isIframe;
  var WebApp = {};
  var webAppInitData = "",
    webAppInitDataUnsafe = {};
  var themeParams = {},
    colorScheme = "light";
  var webAppVersion = "6.0";
  var webAppPlatform = "unknown";
  if (initParams.tgWebAppData && initParams.tgWebAppData.length) {
    webAppInitData = initParams.tgWebAppData;
    webAppInitDataUnsafe = Utils.urlParseQueryString(webAppInitData);
    for (var key in webAppInitDataUnsafe) {
      var val = webAppInitDataUnsafe[key];
      try {
        if (
          (val.substr(0, 1) == "{" && val.substr(-1) == "}") ||
          (val.substr(0, 1) == "[" && val.substr(-1) == "]")
        ) {
          webAppInitDataUnsafe[key] = JSON.parse(val);
        }
      } catch (e) {}
    }
  }
  if (initParams.tgWebAppThemeParams && initParams.tgWebAppThemeParams.length) {
    var themeParamsRaw = initParams.tgWebAppThemeParams;
    try {
      var theme_params = JSON.parse(themeParamsRaw);
      if (theme_params) {
        setThemeParams(theme_params);
      }
    } catch (e) {}
  }
  var theme_params = Utils.sessionStorageGet("themeParams");
  if (theme_params) {
    setThemeParams(theme_params);
  }
  if (initParams.tgWebAppVersion) {
    webAppVersion = initParams.tgWebAppVersion;
  }
  if (initParams.tgWebAppPlatform) {
    webAppPlatform = initParams.tgWebAppPlatform;
  }
  function onThemeChanged(eventType, eventData) {
    if (eventData.theme_params) {
      setThemeParams(eventData.theme_params);
      window.Telegram.WebApp.MainButton.setParams({});
      updateBackgroundColor();
      receiveWebViewEvent("themeChanged");
    }
  }
  var lastWindowHeight = window.innerHeight;
  function onViewportChanged(eventType, eventData) {
    if (eventData.height) {
      window.removeEventListener("resize", onWindowResize);
      setViewportHeight(eventData);
    }
  }
  function onWindowResize(e) {
    if (lastWindowHeight != window.innerHeight) {
      lastWindowHeight = window.innerHeight;
      receiveWebViewEvent("viewportChanged", { isStateStable: true });
    }
  }
  function linkHandler(e) {
    if (e.metaKey || e.ctrlKey) return;
    var el = e.target;
    while (el.tagName != "A" && el.parentNode) {
      el = el.parentNode;
    }
    if (
      el.tagName == "A" &&
      el.target != "_blank" &&
      (el.protocol == "http:" || el.protocol == "https:") &&
      el.hostname == "t.me"
    ) {
      WebApp.openTgLink(el.href);
      e.preventDefault();
    }
  }
  function strTrim(str) {
    return str.toString().replace(/^\s+|\s+$/g, "");
  }
  function receiveWebViewEvent(eventType) {
    var args = Array.prototype.slice.call(arguments);
    eventType = args.shift();
    WebView.callEventCallbacks("webview:" + eventType, function (callback) {
      callback.apply(WebApp, args);
    });
  }
  function onWebViewEvent(eventType, callback) {
    WebView.onEvent("webview:" + eventType, callback);
  }
  function offWebViewEvent(eventType, callback) {
    WebView.offEvent("webview:" + eventType, callback);
  }
  function setCssProperty(name, value) {
    var root = document.documentElement;
    if (root && root.style && root.style.setProperty) {
      root.style.setProperty("--tg-" + name, value);
    }
  }
  function setThemeParams(theme_params) {
    if (
      theme_params.bg_color == "#1c1c1d" &&
      theme_params.bg_color == theme_params.secondary_bg_color
    ) {
      theme_params.secondary_bg_color = "#2c2c2e";
    }
    var color;
    for (var key in theme_params) {
      if ((color = parseColorToHex(theme_params[key]))) {
        themeParams[key] = color;
        if (key == "bg_color") {
          colorScheme = isColorDark(color) ? "dark" : "light";
          setCssProperty("color-scheme", colorScheme);
        }
        key = "theme-" + key.split("_").join("-");
        setCssProperty(key, color);
      }
    }
    Utils.sessionStorageSet("themeParams", themeParams);
  }
  var webAppCallbacks = {};
  function generateCallbackId(len) {
    var tries = 100;
    while (--tries) {
      var id = "",
        chars =
          "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
        chars_len = chars.length;
      for (var i = 0; i < len; i++) {
        id += chars[Math.floor(Math.random() * chars_len)];
      }
      if (!webAppCallbacks[id]) {
        webAppCallbacks[id] = {};
        return id;
      }
    }
    throw Error("WebAppCallbackIdGenerateFailed");
  }
  var viewportHeight = false,
    viewportStableHeight = false,
    isExpanded = true;
  function setViewportHeight(data) {
    if (typeof data !== "undefined") {
      isExpanded = !!data.is_expanded;
      viewportHeight = data.height;
      if (data.is_state_stable) {
        viewportStableHeight = data.height;
      }
      receiveWebViewEvent("viewportChanged", {
        isStateStable: !!data.is_state_stable,
      });
    }
    var height, stable_height;
    if (viewportHeight !== false) {
      height = viewportHeight - mainButtonHeight + "px";
    } else {
      height = mainButtonHeight
        ? "calc(100vh - " + mainButtonHeight + "px)"
        : "100vh";
    }
    if (viewportStableHeight !== false) {
      stable_height = viewportStableHeight - mainButtonHeight + "px";
    } else {
      stable_height = mainButtonHeight
        ? "calc(100vh - " + mainButtonHeight + "px)"
        : "100vh";
    }
    setCssProperty("viewport-height", height);
    setCssProperty("viewport-stable-height", stable_height);
  }
  var isClosingConfirmationEnabled = false;
  function setClosingConfirmation(need_confirmation) {
    if (!versionAtLeast("6.2")) {
      return;
    }
    isClosingConfirmationEnabled = !!need_confirmation;
    WebView.postEvent("web_app_setup_closing_behavior", false, {
      need_confirmation: isClosingConfirmationEnabled,
    });
  }
  var headerColorKey = "bg_color",
    headerColor = null;
  function getHeaderColor() {
    if (headerColorKey == "secondary_bg_color") {
      return themeParams.secondary_bg_color;
    } else if (headerColorKey == "bg_color") {
      return themeParams.bg_color;
    }
    return headerColor;
  }
  function setHeaderColor(color) {
    if (!versionAtLeast("6.1")) {
      return;
    }
    if (!versionAtLeast("6.9")) {
      if (themeParams.bg_color && themeParams.bg_color == color) {
        color = "bg_color";
      } else if (
        themeParams.secondary_bg_color &&
        themeParams.secondary_bg_color == color
      ) {
        color = "secondary_bg_color";
      }
    }
    var head_color = null,
      color_key = null;
    if (color == "bg_color" || color == "secondary_bg_color") {
      color_key = color;
    } else if (versionAtLeast("6.9")) {
      head_color = parseColorToHex(color);
      if (!head_color) {
        throw Error("WebAppHeaderColorInvalid");
      }
    }
    if (
      !versionAtLeast("6.9") &&
      color_key != "bg_color" &&
      color_key != "secondary_bg_color"
    ) {
      throw Error("WebAppHeaderColorKeyInvalid");
    }
    headerColorKey = color_key;
    headerColor = head_color;
    updateHeaderColor();
  }
  var appHeaderColorKey = null,
    appHeaderColor = null;
  function updateHeaderColor() {
    if (appHeaderColorKey != headerColorKey || appHeaderColor != headerColor) {
      appHeaderColorKey = headerColorKey;
      appHeaderColor = headerColor;
      if (appHeaderColor) {
        WebView.postEvent("web_app_set_header_color", false, {
          color: headerColor,
        });
      } else {
        WebView.postEvent("web_app_set_header_color", false, {
          color_key: headerColorKey,
        });
      }
    }
  }
  var backgroundColor = "bg_color";
  function getBackgroundColor() {
    if (backgroundColor == "secondary_bg_color") {
      return themeParams.secondary_bg_color;
    } else if (backgroundColor == "bg_color") {
      return themeParams.bg_color;
    }
    return backgroundColor;
  }
  function setBackgroundColor(color) {
    if (!versionAtLeast("6.1")) {
      return;
    }
    var bg_color;
    if (color == "bg_color" || color == "secondary_bg_color") {
      bg_color = color;
    } else {
      bg_color = parseColorToHex(color);
      if (!bg_color) {
        throw Error("WebAppBackgroundColorInvalid");
      }
    }
    backgroundColor = bg_color;
    updateBackgroundColor();
  }
  var appBackgroundColor = null;
  function updateBackgroundColor() {
    var color = getBackgroundColor();
    if (appBackgroundColor != color) {
      appBackgroundColor = color;
      WebView.postEvent("web_app_set_background_color", false, {
        color: color,
      });
    }
  }
  function parseColorToHex(color) {
    color += "";
    var match;
    if ((match = /^\s*#([0-9a-f]{6})\s*$/i.exec(color))) {
      return "#" + match[1].toLowerCase();
    } else if (
      (match = /^\s*#([0-9a-f])([0-9a-f])([0-9a-f])\s*$/i.exec(color))
    ) {
      return (
        "#" +
        match[1] +
        match[1] +
        match[2] +
        match[2] +
        match[3] +
        match[3]
      ).toLowerCase();
    } else if (
      (match =
        /^\s*rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+\.{0,1}\d*))?\)\s*$/.exec(
          color,
        ))
    ) {
      var r = parseInt(match[1]),
        g = parseInt(match[2]),
        b = parseInt(match[3]);
      r = (r < 16 ? "0" : "") + r.toString(16);
      g = (g < 16 ? "0" : "") + g.toString(16);
      b = (b < 16 ? "0" : "") + b.toString(16);
      return "#" + r + g + b;
    }
    return false;
  }
  function isColorDark(rgb) {
    rgb = rgb.replace(/[\s#]/g, "");
    if (rgb.length == 3) {
      rgb = rgb[0] + rgb[0] + rgb[1] + rgb[1] + rgb[2] + rgb[2];
    }
    var r = parseInt(rgb.substr(0, 2), 16);
    var g = parseInt(rgb.substr(2, 2), 16);
    var b = parseInt(rgb.substr(4, 2), 16);
    var hsp = Math.sqrt(0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b));
    return hsp < 120;
  }
  function versionCompare(v1, v2) {
    if (typeof v1 !== "string") v1 = "";
    if (typeof v2 !== "string") v2 = "";
    v1 = v1.replace(/^\s+|\s+$/g, "").split(".");
    v2 = v2.replace(/^\s+|\s+$/g, "").split(".");
    var a = Math.max(v1.length, v2.length),
      i,
      p1,
      p2;
    for (i = 0; i < a; i++) {
      p1 = parseInt(v1[i]) || 0;
      p2 = parseInt(v2[i]) || 0;
      if (p1 == p2) continue;
      if (p1 > p2) return 1;
      return -1;
    }
    return 0;
  }
  function versionAtLeast(ver) {
    return versionCompare(webAppVersion, ver) >= 0;
  }
  function byteLength(str) {
    if (window.Blob) {
      try {
        return new Blob([str]).size;
      } catch (e) {}
    }
    var s = str.length;
    for (var i = str.length - 1; i >= 0; i--) {
      var code = str.charCodeAt(i);
      if (code > 127 && code <= 2047) s++;
      else if (code > 2047 && code <= 65535) s += 2;
      if (code >= 56320 && code <= 57343) i--;
    }
    return s;
  }
  var BackButton = (function () {
    var isVisible = false;
    var backButton = {};
    Object.defineProperty(backButton, "isVisible", {
      set: function (val) {
        setParams({ is_visible: val });
      },
      get: function () {
        return isVisible;
      },
      enumerable: true,
    });
    var curButtonState = null;
    WebView.onEvent("back_button_pressed", onBackButtonPressed);
    function onBackButtonPressed() {
      receiveWebViewEvent("backButtonClicked");
    }
    function buttonParams() {
      return { is_visible: isVisible };
    }
    function buttonState(btn_params) {
      if (typeof btn_params === "undefined") {
        btn_params = buttonParams();
      }
      return JSON.stringify(btn_params);
    }
    function buttonCheckVersion() {
      if (!versionAtLeast("6.1")) {
        return false;
      }
      return true;
    }
    function updateButton() {
      var btn_params = buttonParams();
      var btn_state = buttonState(btn_params);
      if (curButtonState === btn_state) {
        return;
      }
      curButtonState = btn_state;
      WebView.postEvent("web_app_setup_back_button", false, btn_params);
    }
    function setParams(params) {
      if (!buttonCheckVersion()) {
        return backButton;
      }
      if (typeof params.is_visible !== "undefined") {
        isVisible = !!params.is_visible;
      }
      updateButton();
      return backButton;
    }
    backButton.onClick = function (callback) {
      if (buttonCheckVersion()) {
        onWebViewEvent("backButtonClicked", callback);
      }
      return backButton;
    };
    backButton.offClick = function (callback) {
      if (buttonCheckVersion()) {
        offWebViewEvent("backButtonClicked", callback);
      }
      return backButton;
    };
    backButton.show = function () {
      return setParams({ is_visible: true });
    };
    backButton.hide = function () {
      return setParams({ is_visible: false });
    };
    return backButton;
  })();
  var mainButtonHeight = 0;
  function onClipboardTextReceived(eventType, eventData) {
    if (eventData.req_id && webAppCallbacks[eventData.req_id]) {
      var requestData = webAppCallbacks[eventData.req_id];
      delete webAppCallbacks[eventData.req_id];
      var data = null;
      if (typeof eventData.data !== "undefined") {
        data = eventData.data;
      }
      if (requestData.callback) {
        requestData.callback(data);
      }
      receiveWebViewEvent("clipboardTextReceived", { data: data });
    }
  }
  var WebAppWriteAccessRequested = false;
  function onWriteAccessRequested(eventType, eventData) {
    if (WebAppWriteAccessRequested) {
      var requestData = WebAppWriteAccessRequested;
      WebAppWriteAccessRequested = false;
      if (requestData.callback) {
        requestData.callback(eventData.status == "allowed");
      }
      receiveWebViewEvent("writeAccessRequested", { status: eventData.status });
    }
  }
  function getRequestedContact(callback, timeout) {
    var reqTo,
      fallbackTo,
      reqDelay = 0;
    var reqInvoke = function () {
      invokeCustomMethod("getRequestedContact", {}, function (err, res) {
        if (res && res.length) {
          clearTimeout(fallbackTo);
          callback(res);
        } else {
          reqDelay += 50;
          reqTo = setTimeout(reqInvoke, reqDelay);
        }
      });
    };
    var fallbackInvoke = function () {
      clearTimeout(reqTo);
      callback("");
    };
    fallbackTo = setTimeout(fallbackInvoke, timeout);
    reqInvoke();
  }
  var WebAppContactRequested = false;
  function onPhoneRequested(eventType, eventData) {
    if (WebAppContactRequested) {
      var requestData = WebAppContactRequested;
      WebAppContactRequested = false;
      var requestSent = eventData.status == "sent";
      var webViewEvent = { status: eventData.status };
      if (requestSent) {
        getRequestedContact(function (res) {
          if (res && res.length) {
            webViewEvent.response = res;
            webViewEvent.responseUnsafe = Utils.urlParseQueryString(res);
            for (var key in webViewEvent.responseUnsafe) {
              var val = webViewEvent.responseUnsafe[key];
              try {
                if (
                  (val.substr(0, 1) == "{" && val.substr(-1) == "}") ||
                  (val.substr(0, 1) == "[" && val.substr(-1) == "]")
                ) {
                  webViewEvent.responseUnsafe[key] = JSON.parse(val);
                }
              } catch (e) {}
            }
          }
          if (requestData.callback) {
            requestData.callback(requestSent, webViewEvent);
          }
          receiveWebViewEvent("contactRequested", webViewEvent);
        }, 3e3);
      } else {
        if (requestData.callback) {
          requestData.callback(requestSent, webViewEvent);
        }
        receiveWebViewEvent("contactRequested", webViewEvent);
      }
    }
  }
  function onCustomMethodInvoked(eventType, eventData) {
    if (eventData.req_id && webAppCallbacks[eventData.req_id]) {
      var requestData = webAppCallbacks[eventData.req_id];
      delete webAppCallbacks[eventData.req_id];
      var res = null,
        err = null;
      if (typeof eventData.result !== "undefined") {
        res = eventData.result;
      }
      if (typeof eventData.error !== "undefined") {
        err = eventData.error;
      }
      if (requestData.callback) {
        requestData.callback(err, res);
      }
    }
  }
  function invokeCustomMethod(method, params, callback) {
    if (!versionAtLeast("6.9")) {
      throw Error("WebAppMethodUnsupported");
    }
    var req_id = generateCallbackId(16);
    var req_params = { req_id: req_id, method: method, params: params || {} };
    webAppCallbacks[req_id] = { callback: callback };
    WebView.postEvent("web_app_invoke_custom_method", false, req_params);
  }
  if (!window.Telegram) {
    window.Telegram = {};
  }
  Object.defineProperty(WebApp, "initData", {
    get: function () {
      return webAppInitData;
    },
    enumerable: true,
  });
  Object.defineProperty(WebApp, "initDataUnsafe", {
    get: function () {
      return webAppInitDataUnsafe;
    },
    enumerable: true,
  });
  Object.defineProperty(WebApp, "version", {
    get: function () {
      return webAppVersion;
    },
    enumerable: true,
  });
  Object.defineProperty(WebApp, "platform", {
    get: function () {
      return webAppPlatform;
    },
    enumerable: true,
  });
  Object.defineProperty(WebApp, "colorScheme", {
    get: function () {
      return colorScheme;
    },
    enumerable: true,
  });
  Object.defineProperty(WebApp, "themeParams", {
    get: function () {
      return themeParams;
    },
    enumerable: true,
  });
  Object.defineProperty(WebApp, "isExpanded", {
    get: function () {
      return isExpanded;
    },
    enumerable: true,
  });
  Object.defineProperty(WebApp, "viewportHeight", {
    get: function () {
      return (
        (viewportHeight === false ? window.innerHeight : viewportHeight) -
        mainButtonHeight
      );
    },
    enumerable: true,
  });
  Object.defineProperty(WebApp, "viewportStableHeight", {
    get: function () {
      return (
        (viewportStableHeight === false
          ? window.innerHeight
          : viewportStableHeight) - mainButtonHeight
      );
    },
    enumerable: true,
  });
  Object.defineProperty(WebApp, "isClosingConfirmationEnabled", {
    set: function (val) {
      setClosingConfirmation(val);
    },
    get: function () {
      return isClosingConfirmationEnabled;
    },
    enumerable: true,
  });
  Object.defineProperty(WebApp, "headerColor", {
    set: function (val) {
      setHeaderColor(val);
    },
    get: function () {
      return getHeaderColor();
    },
    enumerable: true,
  });
  Object.defineProperty(WebApp, "backgroundColor", {
    set: function (val) {
      setBackgroundColor(val);
    },
    get: function () {
      return getBackgroundColor();
    },
    enumerable: true,
  });
  Object.defineProperty(WebApp, "BackButton", {
    value: BackButton,
    enumerable: true,
  });
  WebApp.setHeaderColor = function (color_key) {
    WebApp.headerColor = color_key;
  };
  WebApp.setBackgroundColor = function (color) {
    WebApp.backgroundColor = color;
  };
  WebApp.enableClosingConfirmation = function () {
    WebApp.isClosingConfirmationEnabled = true;
  };
  WebApp.disableClosingConfirmation = function () {
    WebApp.isClosingConfirmationEnabled = false;
  };
  WebApp.isVersionAtLeast = function (ver) {
    return versionAtLeast(ver);
  };
  WebApp.onEvent = function (eventType, callback) {
    onWebViewEvent(eventType, callback);
  };
  WebApp.offEvent = function (eventType, callback) {
    offWebViewEvent(eventType, callback);
  };
  WebApp.sendData = function (data) {
    if (!data || !data.length) {
      throw Error("WebAppDataInvalid");
    }
    if (byteLength(data) > 4096) {
      throw Error("WebAppDataInvalid");
    }
    WebView.postEvent("web_app_data_send", false, { data: data });
  };
  WebApp.switchInlineQuery = function (query, choose_chat_types) {
    if (!versionAtLeast("6.6")) {
      throw Error("WebAppMethodUnsupported");
    }
    if (!initParams.tgWebAppBotInline) {
      throw Error("WebAppInlineModeDisabled");
    }
    query = query || "";
    if (query.length > 256) {
      throw Error("WebAppInlineQueryInvalid");
    }
    var chat_types = [];
    if (choose_chat_types) {
      if (!Array.isArray(choose_chat_types)) {
        throw Error("WebAppInlineChooseChatTypesInvalid");
      }
      var good_types = { users: 1, bots: 1, groups: 1, channels: 1 };
      for (var i = 0; i < choose_chat_types.length; i++) {
        var chat_type = choose_chat_types[i];
        if (!good_types[chat_type]) {
          throw Error("WebAppInlineChooseChatTypeInvalid");
        }
        if (good_types[chat_type] != 2) {
          good_types[chat_type] = 2;
          chat_types.push(chat_type);
        }
      }
    }
    WebView.postEvent("web_app_switch_inline_query", false, {
      query: query,
      chat_types: chat_types,
    });
  };
  WebApp.openLink = function (url, options) {
    var a = document.createElement("A");
    a.href = url;
    if (a.protocol != "http:" && a.protocol != "https:") {
      throw Error("WebAppTgUrlInvalid");
    }
    var url = a.href;
    options = options || {};
    if (versionAtLeast("6.1")) {
      WebView.postEvent("web_app_open_link", false, {
        url: url,
        try_instant_view: versionAtLeast("6.4") && !!options.try_instant_view,
      });
    } else {
      window.open(url, "_blank");
    }
  };
  WebApp.openTelegramLink = function (url) {
    var a = document.createElement("A");
    a.href = url;
    if (a.protocol != "http:" && a.protocol != "https:") {
      throw Error("WebAppTgUrlInvalid");
    }
    if (a.hostname != "t.me") {
      throw Error("WebAppTgUrlInvalid");
    }
    var path_full = a.pathname + a.search;
    if (isIframe || versionAtLeast("6.1")) {
      WebView.postEvent("web_app_open_tg_link", false, {
        path_full: path_full,
      });
    } else {
      location.href = "https://t.me" + path_full;
    }
  };
  WebApp.openInvoice = function (url, callback) {
    var a = document.createElement("A"),
      match,
      slug;
    a.href = url;
    if (
      (a.protocol != "http:" && a.protocol != "https:") ||
      a.hostname != "t.me" ||
      !(match = a.pathname.match(/^\/(\$|invoice\/)([A-Za-z0-9\-_=]+)$/)) ||
      !(slug = match[2])
    ) {
      throw Error("WebAppInvoiceUrlInvalid");
    }
    if (!versionAtLeast("6.1")) {
      throw Error("WebAppMethodUnsupported");
    }
    if (webAppInvoices[slug]) {
      throw Error("WebAppInvoiceOpened");
    }
    webAppInvoices[slug] = { url: url, callback: callback };
    WebView.postEvent("web_app_open_invoice", false, { slug: slug });
  };
  WebApp.showPopup = function (params, callback) {
    if (!versionAtLeast("6.2")) {
      throw Error("WebAppMethodUnsupported");
    }
    if (webAppPopupOpened) {
      throw Error("WebAppPopupOpened");
    }
    var title = "";
    var message = "";
    var buttons = [];
    var popup_buttons = {};
    var popup_params = {};
    if (typeof params.title !== "undefined") {
      title = strTrim(params.title);
      if (title.length > 64) {
        throw Error("WebAppPopupParamInvalid");
      }
      if (title.length > 0) {
        popup_params.title = title;
      }
    }
    if (typeof params.message !== "undefined") {
      message = strTrim(params.message);
    }
    if (!message.length) {
      throw Error("WebAppPopupParamInvalid");
    }
    if (message.length > 256) {
      throw Error("WebAppPopupParamInvalid");
    }
    popup_params.message = message;
    if (typeof params.buttons !== "undefined") {
      if (!Array.isArray(params.buttons)) {
        throw Error("WebAppPopupParamInvalid");
      }
      for (var i = 0; i < params.buttons.length; i++) {
        var button = params.buttons[i];
        var btn = {};
        var id = "";
        if (typeof button.id !== "undefined") {
          id = button.id.toString();
          if (id.length > 64) {
            throw Error("WebAppPopupParamInvalid");
          }
        }
        btn.id = id;
        var button_type = button.type;
        if (typeof button_type === "undefined") {
          button_type = "default";
        }
        btn.type = button_type;
        if (
          button_type == "ok" ||
          button_type == "close" ||
          button_type == "cancel"
        ) {
        } else if (button_type == "default" || button_type == "destructive") {
          var text = "";
          if (typeof button.text !== "undefined") {
            text = strTrim(button.text);
          }
          if (!text.length) {
            throw Error("WebAppPopupParamInvalid");
          }
          if (text.length > 64) {
            throw Error("WebAppPopupParamInvalid");
          }
          btn.text = text;
        } else {
          throw Error("WebAppPopupParamInvalid");
        }
        buttons.push(btn);
      }
    } else {
      buttons.push({ id: "", type: "close" });
    }
    if (buttons.length < 1) {
      throw Error("WebAppPopupParamInvalid");
    }
    if (buttons.length > 3) {
      throw Error("WebAppPopupParamInvalid");
    }
    popup_params.buttons = buttons;
    webAppPopupOpened = { callback: callback };
    WebView.postEvent("web_app_open_popup", false, popup_params);
  };
  WebApp.showAlert = function (message, callback) {
    WebApp.showPopup(
      { message: message },
      callback
        ? function () {
            callback();
          }
        : null,
    );
  };
  WebApp.showConfirm = function (message, callback) {
    WebApp.showPopup(
      {
        message: message,
        buttons: [{ type: "ok", id: "ok" }, { type: "cancel" }],
      },
      callback
        ? function (button_id) {
            callback(button_id == "ok");
          }
        : null,
    );
  };
  WebApp.showScanQrPopup = function (params, callback) {
    if (!versionAtLeast("6.4")) {
      throw Error("WebAppMethodUnsupported");
    }
    if (webAppScanQrPopupOpened) {
      throw Error("WebAppScanQrPopupOpened");
    }
    var text = "";
    var popup_params = {};
    if (typeof params.text !== "undefined") {
      text = strTrim(params.text);
      if (text.length > 64) {
        throw Error("WebAppScanQrPopupParamInvalid");
      }
      if (text.length > 0) {
        popup_params.text = text;
      }
    }
    webAppScanQrPopupOpened = { callback: callback };
    WebView.postEvent("web_app_open_scan_qr_popup", false, popup_params);
  };
  WebApp.closeScanQrPopup = function () {
    if (!versionAtLeast("6.4")) {
      throw Error("WebAppMethodUnsupported");
    }
    webAppScanQrPopupOpened = false;
    WebView.postEvent("web_app_close_scan_qr_popup", false);
  };
  WebApp.readTextFromClipboard = function (callback) {
    if (!versionAtLeast("6.4")) {
      throw Error("WebAppMethodUnsupported");
    }
    var req_id = generateCallbackId(16);
    var req_params = { req_id: req_id };
    webAppCallbacks[req_id] = { callback: callback };
    WebView.postEvent("web_app_read_text_from_clipboard", false, req_params);
  };
  WebApp.requestWriteAccess = function (callback) {
    if (!versionAtLeast("6.9")) {
      throw Error("WebAppMethodUnsupported");
    }
    if (WebAppWriteAccessRequested) {
      throw Error("WebAppWriteAccessRequested");
    }
    WebAppWriteAccessRequested = { callback: callback };
    WebView.postEvent("web_app_request_write_access");
  };
  WebApp.requestContact = function (callback) {
    if (!versionAtLeast("6.9")) {
      throw Error("WebAppMethodUnsupported");
    }
    if (WebAppContactRequested) {
      throw Error("WebAppContactRequested");
    }
    WebAppContactRequested = { callback: callback };
    WebView.postEvent("web_app_request_phone");
  };
  WebApp.invokeCustomMethod = function (method, params, callback) {
    invokeCustomMethod(method, params, callback);
  };
  WebApp.ready = function () {
    WebView.postEvent("web_app_ready");
  };
  WebApp.expand = function () {
    WebView.postEvent("web_app_expand");
  };
  WebApp.close = function () {
    WebView.postEvent("web_app_close");
  };
  window.Telegram.WebApp = WebApp;
  updateHeaderColor();
  updateBackgroundColor();
  setViewportHeight();
  if (initParams.tgWebAppShowSettings) {
    SettingsButton.show();
  }
  window.addEventListener("resize", onWindowResize);
  if (isIframe) {
    document.addEventListener("click", linkHandler);
  }
  WebView.onEvent("theme_changed", onThemeChanged);
  WebView.onEvent("viewport_changed", onViewportChanged);
  WebView.onEvent("clipboard_text_received", onClipboardTextReceived);
  WebView.onEvent("write_access_requested", onWriteAccessRequested);
  WebView.onEvent("phone_requested", onPhoneRequested);
  WebView.onEvent("custom_method_invoked", onCustomMethodInvoked);
  WebView.postEvent("web_app_request_theme");
  WebView.postEvent("web_app_request_viewport");
})();
