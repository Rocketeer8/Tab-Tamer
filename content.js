// everything that requires DOM you put it in content.js

function tabsInfo() { 
    chrome.tabs.query({currentWindow: true}, function(tabs) {
        // The 'tabs' array contains information about all open tabs
        // get total number of current tabs and display it
        var numberOfTabs = tabs.length;
        document.getElementById("tabsNumber").innerHTML = "Current tabs: " + numberOfTabs;
        
        // get the maximum allowed tabs and store it in input field
        chrome.runtime.sendMessage({ action: "getMaxTabsAllowed" }, (response) => {
            if (response !== undefined && response.value !== undefined) {
              // console.log("THE MAX TAB RESULT IS " + response.value);
              document.getElementById("numberInput").value = response.value;
            }
        });
    });
}

// listener for user tab limit submission
function addSubmitEventListener() {
    // change display of number field to whatever user input is  
    document.getElementById('submitButton').addEventListener('click', function() {

        var userInput = document.getElementById('numberInput').value;
        
        chrome.tabs.query({currentWindow: true}, function(tabs) {
            chrome.runtime.sendMessage({ action: "getMaxTabsAllowed" }, (response) => {
                if (response !== undefined && tabs.length > userInput) {  // check if current tabs amount and higher than the new set maximum
                    let result = confirm("Maximum lower than current tabs amount, exceeding tabs will be removed!!");
                    if (!result) { // cancel the operation if user click cancel
                        return;
                    }
                }
                // temporary disable warningPopupPreferenceSubmission if closing excessive tabs
                chrome.runtime.sendMessage({action: "warningPopupPreferenceSubmission", value: 'no'}, (response) => {
                    if (response !== undefined) {
                        chrome.runtime.sendMessage({ action: "getWarningPopupPreference" }, (response) => {console.log(response.value)});
                        chrome.runtime.sendMessage({action: "userInputSubmission", value: userInput}, (response) => {
                            successAnimation();
                            chrome.runtime.sendMessage({action: "warningPopupPreferenceSubmission", value: 'yes'});
                        });
                    }
                });
            });
        });
    });
}

function IntegerInputCheck() {
    const numberInput = document.getElementById('numberInput');

    numberInput.addEventListener('input', function () {
        const value = numberInput.value;

        // Use a regular expression to allow only positive integers
        if (!/^[1-9]\d*$/.test(value)) {
            numberInput.value = value.slice(0, -1);
        }
    });

    numberInput.addEventListener('keydown', function (event) {
        // Allow only numeric keys and control keys (backspace, arrow keys, etc.)
        const allowedKeys = ['Backspace', 'ArrowLeft', 'ArrowRight', 'Delete', 'Tab'];
        if (allowedKeys.includes(event.key)) return;

        if (!/^[0-9]$/.test(event.key)) {
            event.preventDefault();
        }
    });
}

function successAnimation() {
    if (!document.querySelector(".notification")) { // make sure notification only displayed once
        // Create notification element
        var notification = document.createElement("div");
        notification.textContent = "Success!";
        notification.classList.add("notification"); // Add CSS class for styling

        // Append notification to the main section
        var mainSection = document.getElementById("mainSection");
        mainSection.appendChild(notification);

        // Apply the slide-in animation
        setTimeout(function() {
        notification.classList.add("slide-in");
        }, 100); // Delay before adding the slide-in class

        // Remove notification after a delay (adjust time as needed)
        setTimeout(function() {
            // Apply the fade-out animation
            notification.classList.add("fade-out");

            // Remove the notification from the DOM after the fade-out animation completes
            setTimeout(function() {
                notification.parentNode.removeChild(notification);
            }, 500); // Duration of the fade-out animation

        }, 2000); // 2 seconds delay
   }
}

// Wrap your code in a DOMContentLoaded listener
// It's possible that the content script is executing before the before the extension APIs are fully available
// that's why you add eventListener here
// everytime you click on extension icon, content script will run, which will trigger 'DOMContentLoaded' event
document.addEventListener('DOMContentLoaded', function() {
    IntegerInputCheck();
    tabsInfo();
    addSubmitEventListener();
});

chrome.tabs.onCreated.addListener(tabsInfo)
chrome.tabs.onRemoved.addListener(tabsInfo)
