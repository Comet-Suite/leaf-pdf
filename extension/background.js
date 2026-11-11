/* Leaf PDF - replace Chrome's built-in PDF viewer.
   Three layers, from earliest to latest:
   1. declarativeNetRequest: redirect any main-frame navigation to a URL whose
      path ends in .pdf straight to the viewer (no built-in flash).
   2. tabs.onUpdated: same redirect for anything DNR missed (odd URLs).
   3. webRequest: catch responses whose Content-Type is application/pdf even
      when the URL has no .pdf suffix. */

const VIEWER = () => chrome.runtime.getURL('index.html');
const target = u => VIEWER() + '?src=' + encodeURIComponent(u);
const isOurs = u => !!u && u.startsWith(chrome.runtime.getURL(''));
const isPdfUrl = u => /^(https?|file):\/\/\S+\.pdf([?#]\S*)?$/i.test(u);

function installRule() {
  try {
    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [1],
      addRules: [{
        id: 1,
        priority: 1,
        action: {
          type: 'redirect',
          redirect: { regexSubstitution: VIEWER() + '?src=\\1' }
        },
        condition: {
          regexFilter: '(?i)^(https?://\\S+\\.pdf([?#]\\S*)?)$',
          resourceTypes: ['main_frame']
        }
      }]
    }).catch(e => console.warn('Leaf PDF: redirect rule failed', e));
  } catch (e) { console.warn('Leaf PDF: redirect rule failed', e); }
}

chrome.runtime.onInstalled.addListener(installRule);
installRule(); // re-apply on service-worker wake-up (idempotent, rules persist)

chrome.tabs.onUpdated.addListener((tabId, info) => {
  const u = info.url;
  if (!u || isOurs(u) || !isPdfUrl(u)) return;
  try { chrome.tabs.update(tabId, { url: target(u) }); } catch (e) {}
});

/* catch PDFs whose URL doesn't end in .pdf: remember the tab while the
   response headers arrive, then redirect once the response has completed
   (redirecting from inside onHeadersReceived leaves the tab with a dead
   network stack, and too early is racy) */
const pendingPdf = new Map();
chrome.webRequest.onHeadersReceived.addListener(details => {
  if (details.tabId < 0 || details.frameId !== 0 || isOurs(details.url)) return;
  const ct = (details.responseHeaders || [])
    .find(h => (h.name || '').toLowerCase() === 'content-type');
  if (ct && /application\/pdf/i.test(ct.value)) pendingPdf.set(details.tabId, details.url);
  else if (pendingPdf.get(details.tabId) === details.url) pendingPdf.delete(details.tabId);
}, { urls: ['<all_urls>'], types: ['main_frame'] }, ['responseHeaders']);

chrome.webRequest.onCompleted.addListener(details => {
  if (details.tabId < 0 || details.frameId !== 0) return;
  if (pendingPdf.get(details.tabId) !== details.url) return;
  pendingPdf.delete(details.tabId);
  try { chrome.tabs.update(details.tabId, { url: target(details.url) }); } catch (e) {}
}, { urls: ['<all_urls>'], types: ['main_frame'] });

chrome.webRequest.onErrorOccurred.addListener(details => {
  if (details.tabId >= 0) pendingPdf.delete(details.tabId);
}, { urls: ['<all_urls>'], types: ['main_frame'] });
