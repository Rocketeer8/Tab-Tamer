// By wrapping your script logic inside the DOMContentLoaded event listener, you ensure that it executes only after 
// the DOM has been fully loaded, addressing the issue of trying to access elements before they exist in the document.
document.addEventListener('DOMContentLoaded', function() {

  // Listen for message from background script
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {

    if (message.action === "displayTabToClose") {
      if (message.value) { // if tab to close exist
        let leastActiveTab = message.value;
        let tabToCloseTitle = leastActiveTab ? leastActiveTab.title || 'Unnamed Tab' : '';
  
        document.getElementById("tab-to-close").innerHTML = "- " + tabToCloseTitle;
      } else {
        throw new Error("Tab to close not found!");
      }
    } 
    });

  document.getElementById('confirmButton').addEventListener('click', function() {
    chrome.runtime.sendMessage({action: "removeLeastActiveConfirm"});
  });

  document.getElementById('undoButton').addEventListener('click', function() {
    chrome.runtime.sendMessage({action: "undoRmoveLeastActive"});
  });

});