// Service worker. It holds no state: the side panel does the work and Chrome may stop this worker at any time.
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
});
