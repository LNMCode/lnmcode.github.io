(() => {
  'use strict';

  const base = new URL('./', document.currentScript.src);
  let offlineStatus = 'Đang tải tài nguyên để chơi ngoại tuyến…';
  window.HSK_OFFLINE = { status: () => offlineStatus };

  function setOfflineStatus(text) {
    offlineStatus = text;
    const label = document.querySelector('[data-offline-status]');
    if (label) label.textContent = text;
  }

  async function setUpOffline() {
    if (!window.isSecureContext || !('serviceWorker' in navigator)) {
      setOfflineStatus('Trình duyệt này cần kết nối mạng để mở trò chơi.');
      return;
    }

    const serviceWorker = navigator.serviceWorker;
    const workerUrl = new URL('sw.js', base).href;
    const updatePanel = document.getElementById('hsk1-update');
    const updateText = document.getElementById('hsk1-update-text');
    const updateButton = updatePanel.querySelector('button');
    let controller = serviceWorker.controller;
    let reloadRequested = false;
    let registration;

    serviceWorker.addEventListener('controllerchange', () => {
      const nextController = serviceWorker.controller;
      if (nextController?.scriptURL !== workerUrl) return;
      if (reloadRequested) {
        location.reload();
        return;
      }
      if (controller && nextController !== controller) updatePanel.hidden = false;
      controller = nextController;
      setOfflineStatus('Trò chơi đã sẵn sàng để học ngoại tuyến.');
    });

    updateButton.addEventListener('click', () => {
      if (!registration.waiting) {
        location.reload();
        return;
      }
      reloadRequested = true;
      updateButton.disabled = true;
      updateText.textContent = 'Đang mở bản mới…';
      registration.waiting.postMessage('activate-hsk1-update');
    });

    function inspectWorker(worker) {
      if (!worker) return;
      const check = () => {
        if (worker.state === 'installed' && serviceWorker.controller?.scriptURL === workerUrl) {
          updatePanel.hidden = false;
        } else if (worker.state === 'redundant' && !registration.active) {
          setOfflineStatus('Chưa lưu được tài nguyên ngoại tuyến. Bạn có thể thử tải lại khi có mạng.');
        }
      };
      check();
      worker.addEventListener('statechange', check);
    }

    try {
      registration = await serviceWorker.register(workerUrl, { scope: base.href, updateViaCache: 'none' });
      if (registration.active) setOfflineStatus('Trò chơi đã sẵn sàng để học ngoại tuyến.');
      if (registration.waiting) updatePanel.hidden = false;
      inspectWorker(registration.installing);
      registration.addEventListener('updatefound', () => inspectWorker(registration.installing));
    } catch {
      setOfflineStatus('Chưa lưu được tài nguyên ngoại tuyến. Bạn vẫn có thể học khi có mạng.');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('#app > main.app-main')) void setUpOffline();
  }, { once: true });
})();
