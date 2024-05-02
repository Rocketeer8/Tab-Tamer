// var maxTabs = 10;
// var closingMode = "most recent"; // either "most recent" or "least active"

// set value in user's local storage that last the lifetime of browser
function setData(data, callback) { 
    // data is an object with key and value pair(s)
    chrome.storage.local.set(data, function() {
        if (chrome.runtime.lastError) {
            console.log("Error Storing data: " + JSON.stringify(data));
            if (chrome.runtime.lastError.message) {
                console.error(chrome.runtime.lastError.message);
            } else {
                console.error(chrome.runtime.lastError);
            }
            callback("Set data fail!"); // Call the callback with false to indicate an error
            // Handle error if storage operation fails
        } else {
            // Handle success
            callback("Set data success!"); // Call the callback with true to indicate success
        }
    });
}

// callback function ensure the value is available when the callback is exectued
function getData(keys, callback) {
    // keys is a list
    chrome.storage.local.get(keys, function(resultObj) {
        if (chrome.runtime.lastError) {
          console.log("Error retrieving data: " + chrome.runtime.lastError.message);
          callback(undefined); // Call the callback with undefined to indicate an error
        } else {
          // console.log("Value of 'key': " + resultObj[keys[0]]);
          callback(resultObj); // Call the callback with the retrieved value
        }
    });
}

// only allow modify one value at a time to avoid complexity and confusion
function modifyData(key, newValue) {
    chrome.storage.local.get([key], function(result) {
        if (chrome.runtime.lastError) {
          console.error("Error retrieving data: " + chrome.runtime.lastError.message);
        } else {
          // console.log("Current value of 'key': " + result.key);
      
          // Modify value
          result.key = newValue;
          // Save modified data
          chrome.storage.local.set({key: result.key}, function() {
            if (chrome.runtime.lastError) {
              console.error("Error modifying data: " + chrome.runtime.lastError.message);
            } else {
              // console.log("Data modified successfully!");
            }
          });
        }
    });
}

function closeLeastActiveTab() {
    chrome.tabs.query({currentWindow: true}, function(tabs) {
        newestTab = tabs[tabs.length-1];
        // Sort tabs based on last access time
        tabs.sort(function(a, b) {
            return a.lastAccessed - b.lastAccessed;
        });
        // Close the least active tab (first tab in sorted array)
        if (tabs.length > 0) {
            chrome.tabs.remove(tabs[0].id);
        }
    });
}

function closeMostRecentTab() {
    chrome.tabs.query({currentWindow: true}, function(tabs) {
        var mostRecentTab = tabs[tabs.length - 1];
        if (tabs.length > 0) {
            chrome.tabs.remove(mostRecentTab.id);
        }
    })
}


function checkTabs() {
    chrome.tabs.query({currentWindow: true}, function(tabs) {
        // The 'tabs' array contains information about all open tabs
        if (tabs === undefined) {
            return
        }
        numberOfTabs = tabs.length;

        
        getData(['maxTabs', 'closingMode'], function(resultObj) {
            if (numberOfTabs > resultObj['maxTabs']) {
                if (resultObj['closingMode'] === "most recent") {
                    closeMostRecentTab();
                } else if (resultObj['closingMode'] === "least active") {
                    closeLeastActiveTab();
                }
            }
        });
    });
}


// listener for message passing
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    // Check if the message contains the value
    if (message.action === "userInputSubmission" && message.value) {
        setData({"maxTabs": parseInt(message.value)}, (msg) => console.log(msg));

        // checktab if user input maxTabs and close additional tabs if needed
        checkTabs()
    } else if (message.action === "closingModeSubmission" && message.value) {
        setData({"closingMode": message.value}, (msg) => console.log(msg));

    } else if (message.action === "getMaxTabsAllowed") { // listen to request from content.js to get max tab number field value
        // Respond with the current value of the number field
        getData(['maxTabs'], function(resultObj) {
            sendResponse({ value: resultObj['maxTabs'] });
        })
        // By returning true from the message listener function, you're telling the 
        // Chrome runtime to keep the message port open, even after the listener function returns. 
        return true;
    } else if (message.action === "getClosingMode") { // listen to request from content.js to get max tab number field value
        // Respond with the current value of the number field
        getData(['closingMode'], function(resultObj) {
            sendResponse({ value: resultObj['closingMode'] });
        })
        return true;
    } 
});

// Set default values for Chrome Storage
chrome.storage.local.get(['maxTabs', 'closingMode'], function(resultObj) {
    if (resultObj === undefined || resultObj === null || Object.keys(resultObj).length === 0) {
        chrome.storage.local.set({"maxTabs": 15, "closingMode": "most recent"}, function() {
            console.log("Default values set for Chrome Storage.");
        });
    }
});
// Call the function when the extension is first loaded
checkTabs();

// Listen for tab events (e.g., when a new tab is created or an existing one is closed)
chrome.tabs.onCreated.addListener(checkTabs);
chrome.tabs.onRemoved.addListener(checkTabs);
