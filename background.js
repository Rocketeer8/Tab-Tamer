// background.js file runs in the background and is automatically executed when the extension is loaded.

// set value in user's local storage that last the lifetime of browser
function setData(data) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set(data, function() {
            if (chrome.runtime.lastError) {
                console.error("Error storing data: " + JSON.stringify(data));
                console.error(chrome.runtime.lastError.message || chrome.runtime.lastError);
                reject(chrome.runtime.lastError.message || chrome.runtime.lastError); // Reject the promise with an error message
            } else {
                resolve("Set data success!"); // Resolve the promise with a success message
            }
        });
    });
}

// callback function ensure the value is available when the callback is exectued
function getData(keys) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(keys, function(resultObj) {
            if (chrome.runtime.lastError) {
                console.log("Error retrieving data: " + chrome.runtime.lastError.message);
                reject(chrome.runtime.lastError);
            } else {
                resolve(resultObj);
            }
        });
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

async function closeLeastActiveTabs(amount) {
    for (let i = amount; i > 0; i--) {
        let tabs = await chrome.tabs.query({ currentWindow: true });

        if (tabs.length > 0) {
            let mostRecentTab = tabs[tabs.length - 1];

            // Sort tabs based on last access time
            tabs.sort((a, b) => a.lastAccessed - b.lastAccessed);
            let leastActiveTab = tabs[0];

            try {
                let resultObj = await getData(['warningPopupPreference']);

                // if warning popup is enabled, don't close least active tab yet and show warning 
                // else, close least active tab immediately
                if (resultObj['warningPopupPreference'] === 'yes') {
                    await chrome.tabs.remove(mostRecentTab.id);
                    await activateWarningTab("least active", leastActiveTab);
                } else if (resultObj['warningPopupPreference'] === 'no') {
                    await chrome.tabs.remove(leastActiveTab.id);
                }
            } catch (error) {
                console.error("Failed to get warningPopupPreference:", error);
            }
        }
    }
}

async function closeMostRecentTabs(amount) {
    for (let i = amount; i > 0; i--) {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        if (tabs.length > 0) {
            let mostRecentTab = tabs[tabs.length - 1];
            await chrome.tabs.remove(mostRecentTab.id);

            try{
                let resultObj = await getData(['warningPopupPreference']);

                if (resultObj['warningPopupPreference'] === 'yes') {
                    await activateWarningTab("most recent", mostRecentTab);
                }
            } catch (error) {
                console.error("Failed to get warningPopupPreference:", error);
            }

        }
    }
}


export const activateWarningTab = (function() {

    let lock = false;

    return async function(criteria, tabToClose) {
        console.log('activateWarningTab called with criteria:', criteria);
        console.log('Tab to close:', tabToClose);
        if (lock) return;

        lock = true;
        try {
            const tabs = await chrome.tabs.query({});
            let warningTab;

            await updateMaxTabs(1);

            if (criteria === "most recent") {
                warningTab = tabs.find(tab => tab.url === chrome.runtime.getURL("Exceed Tab Warning/reminder.html"));
            } else if (criteria === "least active") {
                warningTab = tabs.find(tab => tab.url === chrome.runtime.getURL("Exceed Tab Warning/reminder least active.html"));
            } else {
                throw new Error("Invalid criteria specified");
            }
            
            // if warning tab already exists, switch to it
            if (warningTab) {
                await chrome.tabs.update(warningTab.id, { active: true });
                if (criteria === "least active") {
                    chrome.tabs.sendMessage(warningTab.id, { action: "displayTabToClose", value: tabToClose });
                }
            } else {
                // if warning tab does not exist, create the warning tab and name it "tab"
                let tab;

                if (criteria === "most recent") {
                    tab = await chrome.tabs.create({ url: chrome.runtime.getURL("Exceed Tab Warning/reminder.html") });
                } else if (criteria === "least active") {
                    tab = await new Promise((resolve, reject) => {
                        chrome.tabs.create({ url: chrome.runtime.getURL("Exceed Tab Warning/reminder least active.html") }, function(tab) {
                            chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
                                if (tabId === tab.id && changeInfo.status === "complete") {
                                    chrome.tabs.sendMessage(tab.id, { action: "displayTabToClose", value: tabToClose });
                                    // Remove the listener once the tab is fully loaded
                                    chrome.tabs.onUpdated.removeListener(listener);
                                    resolve(tab);
                                }
                            });
                        });
                    });
                } else {
                    throw new Error("Invalid criteria specified");
                }

                // Set timeout and pass timeoutID to reminderMessageListener
                let timeoutID = setTimeout(() => {
                    warningTabResolution(criteria, tabToClose, tab, false);
                }, 15000); // 15000 milliseconds = 15 seconds

                detectRemoved(tab.id, timeoutID);

                // Wait for the timeoutPromise to resolve
                reminderMessageListener(timeoutID, tabToClose, tab);


            }
        } catch (error) {
            console.error("Error in activateWarningTab:", error);
        } 
    };
    async function warningTabResolution(criteria, tabToClose, warningTab, undo) {
        try {
            const warningTabExist = await chrome.tabs.get(warningTab.id).catch(() => null);
            if (warningTabExist) {
                // If tab to close still exists for least active tab
                if (criteria === "least active" && !undo) {
                    chrome.tabs.get(tabToClose.id, async function(tab) {
                        if (!chrome.runtime.lastError) {
                            await chrome.tabs.remove(tabToClose.id);
                        } 
                    });
                }
                await chrome.tabs.remove(warningTab.id);
            }
        } catch (error) {
            console.log("Error closing tab:", error);
        } finally {
            await updateMaxTabs(-1);
            lock = false;
            checkTabs(); // see if there are new extra tabs being open during the 10 seconds period
        }
    }
    
    function reminderMessageListener(timeoutID, tabToClose, warningTab) {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === "removeLeastActiveConfirm") {
                // console.log("Received 'removeLeastActiveConfirm' ");
                clearTimeout(timeoutID); // Clear the correct timeout
                warningTabResolution("least active", tabToClose, warningTab, false);
                return true;
            } else if (message.action === "undoRmoveLeastActive") {
                // console.log("Received 'undoRmoveLeastActive' ");
                clearTimeout(timeoutID); // Clear the correct timeout
                warningTabResolution("least active", tabToClose, warningTab, true);
                return true;
            }
        });
    }

    async function updateMaxTabs(delta) {
        try{
            let resultObj = await getData(['maxTabs']);
            const updatedMaxTabs = resultObj['maxTabs'] + delta;
    
            let resultMsg = await setData({ "maxTabs": updatedMaxTabs });
            // (optional), print resultMsg if you want
            // console.log(resultMsg);
    
        } catch (error) {
            console.error("Failed to get maxTabs or set maxTabs:", error);
        }
    }

    function detectRemoved(warningTabId, timeoutID) {
        chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
            console.log("detect removed!");
            if(warningTabId === tabId) {
                console.log("detect removed! AND same ID!");
                clearTimeout(timeoutID); // Clear the correct timeout

                // do the same as the finally statement if warning tab is closed prematurely
                await updateMaxTabs(-1);
                lock = false;
                checkTabs();// see if there are new extra tabs being open during the 10 seconds period

                return true;
            }
        });
    }

})();


async function checkTabs() {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ currentWindow: true }, async function(tabs) {
            if (tabs === undefined) {
                resolve();
                return;
            }
            const numberOfTabs = tabs.length;
            try {
                let resultObj = await getData(['maxTabs', 'closingMode']);
                if (numberOfTabs > resultObj['maxTabs']) {
                    let tabsToClose = numberOfTabs - resultObj['maxTabs'];
                    if (resultObj['closingMode'] === "most recent") {
                        await closeMostRecentTabs(tabsToClose);
                    } else if (resultObj['closingMode'] === "least active") {
                        await closeLeastActiveTabs(tabsToClose);
                    }
                }
                resolve();
            } catch (error) {
                console.error("Failed to get maxTabs or closing mode:", error);
                reject(error);
            }
        });
    });
}


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    // handleAsync ensures that the asynchronous operations are fully contained and 
    // completed before the message listener function exits. Notice the async keyword
    // if you remove handleAsync and put async on the addListener it WILL NOT work
    // because When sendResponse is called directly within the listener without ensuring the listener returns immediately, 
    // the message port may close before the asynchronous operations complete.
    const handleAsync = async () => {
        if (message.action === "userInputSubmission" && message.value) {
            try {
                await setData({"maxTabs": parseInt(message.value)});
                await checkTabs();
                sendResponse({ value: "Success!"});
            } catch (error) {
                console.error("Failed to set maxTabs in userInputSubmission:", error);
                sendResponse({ value: "Error!", error: error.message });
            }
        } else if (message.action === "closingModeSubmission" && message.value) {
            try {
                await setData({"closingMode": message.value});
                sendResponse({ value: "Success!" });
            } catch (error) {
                console.error("Failed to set closingMode in closingModeSubmission:", error);
                sendResponse({ value: "Error!", error: error.message });
            }
        } else if (message.action === "warningPopupPreferenceSubmission") {
            try {
                await setData({"warningPopupPreference": message.value});
                sendResponse({ value: "Success!" });
            } catch (error) {
                console.error("Failed to set warningPopupPreference in warningPopupPreferenceSubmission:", error);
                sendResponse({ value: "Error!", error: error.message });
            }
        } else if (message.action === "getMaxTabsAllowed") {
            try {
                let resultObj = await getData(['maxTabs']);
                sendResponse({ value: resultObj['maxTabs'] });
            } catch (error) {
                console.error("Failed to get maxTabs in getMaxTabsAllowed:", error);
                sendResponse({ value: "Error!", error: error.message });
            }
        } else if (message.action === "getClosingMode") {
            try {
                let resultObj = await getData(['closingMode']);
                sendResponse({ value: resultObj['closingMode'] });
            } catch (error) {
                console.error("Failed to get closingMode in getClosingMode:", error);
                sendResponse({ value: "Error!", error: error.message });
            }
        } else if (message.action === "getWarningPopupPreference") {
            try {
                let resultObj = await getData(['warningPopupPreference']);
                sendResponse({ value: resultObj['warningPopupPreference'] });
            } catch (error) {
                console.error("Failed to get warningPopupPreference in getWarningPopupPreference:", error);
                sendResponse({ value: "Error!", error: error.message });
            }
        }
    };
    handleAsync();
    return true; // Keep the message port open for the async response
});



async function getSettingsOrSetDefault() {
    try {
        // Fetch the current values from Chrome storage
        let resultObj = await getData(['maxTabs', 'closingMode', 'warningPopupPreference']);
        
        // Check if the values are undefined, null, or empty
        if (resultObj === undefined || resultObj === null || Object.keys(resultObj).length === 0) {
            // Set default values
            await setData({
                // don't set max tab by default so exceesive tabs won't be removed when 
                // the extension first launched, let user set it instead
                // "maxTabs": 15,
                "closingMode": "most recent",
                "warningPopupPreference": "yes"
            });
            //console.log("Default values set for Chrome Storage.");
        }
    } catch (error) {
        console.log("Failed to get default values for Chrome Storage, setting default data now...");
    }
}


/*
async function getSettingsOrSetDefault() {
    try {
        await getData(['maxTabs', 'closingMode', 'warningPopupPreference']);
    } catch (error) {
        try {
            await setData({
                "maxTabs": 15,
                "closingMode": "most recent",
                "warningPopupPreference": "yes"
            });
            console.log("Default values set for Chrome Storage.");
        } catch (setDataError) {
            console.error("Failed to set default values for Chrome Storage:", setDataError);
        }
    }
}
*/

// Call the function when the extension is first loaded
getSettingsOrSetDefault();

// check for potential tab limit reach when extension first loaded
// THE FOLLOWING LINE WAS THE CAUSE OF THE uncheck no SW ERROR!!
// checkTabs(); 

// Listen for tab events (e.g., when a new tab is created or an existing one is closed)
chrome.tabs.onCreated.addListener(checkTabs);


