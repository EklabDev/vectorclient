(function () {
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    var forms = document.querySelectorAll('[data-vc-form]');
    forms.forEach(function (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var root = form.closest('.vc-panel');
        var errorEl = root.querySelector('[data-vc-error]');
        var resultEl = root.querySelector('[data-vc-result]');
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
        fetch(window.vectorClientPublic.restUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-WP-Nonce': window.vectorClientPublic.nonce,
          },
          body: JSON.stringify(payload),
        })
          .then(function (res) {
            return res.json().then(function (body) {
              return { res: res, body: body };
            });
          })
          .then(function (_ref) {
            var res = _ref.res;
            var body = _ref.body;
            if (!res.ok || (body && body.ok === false)) {
              errorEl.textContent =
                (body && (body.message || (body.data && body.data.message))) ||
                'Request failed';
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
    });
  });
})();
