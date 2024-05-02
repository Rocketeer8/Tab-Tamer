// everything that requires DOM you put it in content.js

function tabsInfo() { 
    chrome.tabs.query({currentWindow: true}, function(tabs) {
        // The 'tabs' array contains information about all open tabs
        // get total number of current tabs and display it
        var numberOfTabs = tabs.length;
        document.getElementById("tabsNumber").innerHTML = "Current tabs: " + numberOfTabs;
        
        // get the maximum allowed tabs and store it in input field
        chrome.runtime.sendMessage({ action: "getMaxTabsAllowed" }, (response) => {
            if (response !== undefined) {
              // console.log("THE MAX TAB RESULT IS " + response.value);
              document.getElementById("numberInput").value = response.value;
            }
        });

        // get the closing mode
        chrome.runtime.sendMessage({ action: "getClosingMode" }, (response) => {
            if (response !== undefined) {
                console.log("THE CLOSING MODE RESULT IS " + response.value);
                document.getElementById(response.value).checked = true;
            }
        });
    });
}

// listener for user tab limit submission
function addSubmitEventListener() {
    // change display of number field to whatever user input is  
    document.getElementById('submitButton').addEventListener('click', function() {
        var userInput = document.getElementById('numberInput').value;
        chrome.runtime.sendMessage({action: "userInputSubmission", value: userInput});

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

    });
}

function closingModeListener() {
    var radioButtons = document.querySelectorAll('input[name="mode"]');

    // Add event listener to each radio button
    radioButtons.forEach(function(radioButton) {
        radioButton.addEventListener('change', function(event) {
            // Check which radio button is selected
            // event.target.value is either most recent or least active
            chrome.runtime.sendMessage({action: "closingModeSubmission", value: event.target.value});
        });
    });
}

// Wrap your code in a DOMContentLoaded listener
// It's possible that the content script is executing before the before the extension APIs are fully available
// that's why you add eventListener here
document.addEventListener('DOMContentLoaded', function() {
    // Your code here
    tabsInfo();
    addSubmitEventListener();
    closingModeListener();
});
