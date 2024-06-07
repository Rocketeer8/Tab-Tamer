function getUserSettings() {
    // get the saved user settings

    chrome.runtime.sendMessage({ action: "getClosingMode" }, (response) => {
        if (response !== undefined) {
            document.getElementById(response.value).checked = true;
        }
    });

    chrome.runtime.sendMessage({ action: "getWarningPopupPreference" }, (response) => {
        if (response !== undefined) {
            if (response.value === 'yes') {
                document.getElementById("warningPopup").checked = true;
            } else {
                document.getElementById("warningPopup").checked = false;
            }
        }
    });
}

function closingModeListener() {
    var radioButtons = document.querySelectorAll('input[name="mode"]');

    // Add event listener to each radio button
    radioButtons.forEach(function(radioButton) {
        radioButton.addEventListener('change', function(event) {
            // Check which radio button is selected
            // event.target is the radiobutton that's changed out of all the radio button
            // event.target.value is either most recent or least active
            if (event.target.value === "least active") {
                alert("By selecting this, you will be at risk of losing your old tabs when the limit is reached!");
            }

            chrome.runtime.sendMessage({action: "closingModeSubmission", value: event.target.value});
        });
    });
}

function warningPopupListener() {
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');

    checkboxes.forEach(function (checkbox) {
        checkbox.addEventListener('change', function(event) {
            const checkbox = event.target;
            if (!checkbox.checked) {
                alert("By selecting this, Your exceeding tabs will close without warning!");
                chrome.runtime.sendMessage({action: "warningPopupPreferenceSubmission", value: "no"});
            } else {
                chrome.runtime.sendMessage({action: "warningPopupPreferenceSubmission", value: "yes"});
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', function() {
    getUserSettings();
    closingModeListener();
    warningPopupListener();
});