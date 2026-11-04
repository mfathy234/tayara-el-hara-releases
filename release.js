(function () {
  var REPO = 'mfathy234/tayara-el-hara-releases';
  var API = 'https://api.github.com/repos/' + REPO + '/releases/latest';
  var SAFE = /^https:\/\/github\.com\/mfathy234\/tayara-el-hara-releases\/releases\/download\//;
  var ar = document.documentElement.lang === 'ar';
  var root = document.documentElement;

  function setAll(selector, fn) {
    document.querySelectorAll(selector).forEach(fn);
  }

  function digits(text) {
    return ar ? String(text).replace(/\d/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.charAt(d); }) : String(text);
  }

  fetch(API, { headers: { Accept: 'application/vnd.github+json' } })
    .then(function (r) {
      if (r.status === 404) return null;
      return r.ok ? r.json() : Promise.reject(new Error(String(r.status)));
    })
    .then(function (rel) {
      if (!rel) {
        root.setAttribute('data-release', 'none');
        setAll('[data-version-tag]', function (el) { el.textContent = ar ? 'قريبًا' : 'Coming soon'; });
        setAll('[data-apk-download]', function (a) {
          a.href = 'https://github.com/' + REPO + '/releases';
        });
        return;
      }
      var version = String(rel.tag_name || '').replace(/^v/, '');
      var apk = null;
      (rel.assets || []).forEach(function (asset) {
        if (asset.name === 'TayaraElHara.apk') apk = asset;
      });
      if (apk && SAFE.test(apk.browser_download_url)) {
        setAll('[data-apk-download]', function (a) { a.href = apk.browser_download_url; });
      }
      if (version) {
        var size = apk && apk.size ? ' · ' + digits(Math.round(apk.size / 1048576)) + (ar ? ' ميجا' : ' MB') : '';
        setAll('[data-version-tag]', function (el) {
          el.textContent = digits((ar ? 'الإصدار ' : 'Version ') + version) + size;
        });
        root.setAttribute('data-release', version);
      }
    })
    .catch(function () {});
})();
