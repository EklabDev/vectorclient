(function () {
  function bind(panel) {
    var form = panel.querySelector('[data-vc-form]');
    if (!form) return;
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var proxyUrl = panel.getAttribute('data-proxy-url');
      var errorEl = panel.querySelector('[data-vc-error]');
      var resultEl = panel.querySelector('[data-vc-result]');
      var button = form.querySelector('.vc-panel__submit');
      var raw = form.querySelector('[name="payload"]').value;
      var payload;

      errorEl.hidden = true;
      resultEl.hidden = true;

      try {
        payload = JSON.parse(raw);
      } catch (err) {
        errorEl.textContent = 'Payload must be valid JSON.';
        errorEl.hidden = false;
        return;
      }

      button.disabled = true;
      fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'same-origin',
      })
        .then(function (res) {
          return res.json().then(function (body) {
            return { res: res, body: body };
          });
        })
        .then(function (_ref) {
          var res = _ref.res;
          var body = _ref.body;
          if (!res.ok) {
            errorEl.textContent = (body && body.message) || 'Request failed';
            errorEl.hidden = false;
            return;
          }
          resultEl.textContent = JSON.stringify(body.data != null ? body.data : body, null, 2);
          resultEl.hidden = false;
        })
        .catch(function (err) {
          errorEl.textContent = err.message || 'Network error';
          errorEl.hidden = false;
        })
        .finally(function () {
          button.disabled = false;
        });
    });
  }

  document.querySelectorAll('[data-vc-shopify-panel]').forEach(bind);
})();
