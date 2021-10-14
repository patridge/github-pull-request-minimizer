// TODO: Offer options button from main pop-up

const newNamePrefixInput = document.getElementById("newNamePrefixInput");
const addNewPrefixButton = document.getElementById("addNewPrefixButton");
const statusLabel = document.getElementById("status");
const prefixList = document.getElementById("namePrefixes");

const delay = function (timeInMilliseconds) {
    return new Promise(resolve => setTimeout(resolve, timeInMilliseconds));
}
const confirm = async function (message, action, successMessage) {
    const didConfirm = window.confirm(message);
    if (didConfirm) {
        await action();
        if (successMessage) {
            await displayStatus(successMessage);
        }
    }
};
const displayStatus = async function (statusMessage) {
    statusLabel.textContent = statusMessage;
    await delay(1500);
    statusLabel.textContent = "";
};

const storageSyncGetAsync = function (keysAndDefaults) {
    const gotValue = new Promise((resolve, reject) => {
        chrome.storage.sync.get(
            keysAndDefaults, // NOTE: `null` will get entire contents of storage
            function (result) {
                // Keys could be a string or an array of strings (or any object to get back an empty result, or null to get all of cache).
                // Unify to an array regardless.
                let keyList = Array.isArray(keysAndDefaults) ? [...keysAndDefaults] : [keysAndDefaults];
                for (var keyIndex in keyList) {
                    var key = keyList[keyIndex];
                    if (result[key]) {
                        console.log({status: `Cache found: [${key}]`, keys: keysAndDefaults, result });
                    }
                    else {
                        console.log({status: `Cache miss: [${key}]`, keys: keysAndDefaults });
                    }
                }
                resolve(result);
            }
        );
    });
    return gotValue;
};
const storageSyncSetAsync = function (items) {
    const setValue = new Promise((resolve, reject) => {
        chrome.storage.sync.set(
            items,
            function () {
                // If this cache call fails, Chrome will have set `runtime.lastError`.
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message || `Cache set error: ${chrome.runtime.lastError}`));
                }
                else {
                    resolve();
                }
            }
        );
    });
    return setValue;
};

const getHasSetCustomPrefixes = async function () {
    return (await storageSyncGetAsync({ hasSetPrefixes: false })).hasSetPrefixes;
}
const setHasSetCustomPrefixes = async function () {
    await storageSyncSetAsync({ hasSetPrefixes: true });
}
const getPrefixes = async function () {
    const currentSavedPrefixes = await storageSyncGetAsync(
        {
            namePrefixes: []
        }
    );
    console.log(currentSavedPrefixes);
    return currentSavedPrefixes.namePrefixes;
};
const setMicrosoftDocsAndLearnDefaultPrefixes = async function () {
    const hasSetCustomPrefixes = await getHasSetCustomPrefixes();
    if (!hasSetCustomPrefixes) {
        const currentPrefixes = await getPrefixes();
        if (currentPrefixes.length !== 0) {
            return;
        }

        statusLabel.textContent = "Setting up defaults prefix...";

        // Set up MicrosoftDocs defaults
        const microsoftDocsDefaultPrefixes = [
            "opbld",
            "PRMerger",
            "acrolinxatmsft"
        ];
        await storageSyncSetAsync({ namePrefixes: microsoftDocsDefaultPrefixes });

        statusLabel.textContent = "Defaults set. Updating list...";
        await displaySavedNamePrefixes();
        statusLabel.textContent = "List refreshed.";

        await delay(1500);
        statusLabel.textContent = "";
    }
};

const saveNewNamePrefix = async function (namePrefix) {
    const currentSavedPrefixes = await getPrefixes();
    // Append new prefix to list
    const newPrefixesToSave = [...currentSavedPrefixes, namePrefix];
    // Save new prefix list to storage
    await storageSyncSetAsync({ namePrefixes: newPrefixesToSave });
    setHasSetCustomPrefixes();
};
const addNewPrefixButtonClick = async function(event) {
    statusLabel.textContent = "Adding prefix...";

    const newNamePrefix = newNamePrefixInput.value;
    await saveNewNamePrefix(newNamePrefix);
    newNamePrefixInput.value = "";

    statusLabel.textContent = "Prefix added. Updating list...";

    // Refresh prefix list display
    await displaySavedNamePrefixes();

    statusLabel.textContent = "List refreshed.";

    await delay(1500);
    statusLabel.textContent = "";
};

const getSiblings = function (el, filter) {
    const siblings = [];
    el = el.parentNode.firstChild;
    do { if (!filter || filter(el)) siblings.push(el); } while (el = el.nextSibling);
    return siblings;
};
const removePrefixClick = async function (event) {
    statusLabel.textContent = "Removing prefix...";

    const removeButtonSender = event.target;
    // Find adjacent text node with prefix value
    const prefixSpan = getSiblings(removeButtonSender, (sibling) => sibling.tagName.toLowerCase() === "span")[0];
    const prefixToRemove = prefixSpan.textContent;

    // Confirm removal
    const confirmed = window.confirm(`Delete '${prefixToRemove}'?`);
    if (!confirmed) {
        statusLabel.textContent = "Remove cancelled.";
        await delay(1500);
        statusLabel.textContent = "";
        event.preventDefault();
        return;
    }

    // Remove event
    removeButtonSender.removeEventListener("click", removePrefixClick);
    // Get saved prefixes
    const savedNamePrefixes = (await getPrefixes());
    // Trim out removed prefix (if found)
    const newNamePrefixes = savedNamePrefixes.filter(prefix => prefix !== prefixToRemove);
    // Save latest prefix list (assumes it was changed)
    await storageSyncSetAsync({ namePrefixes: newNamePrefixes });
    setHasSetCustomPrefixes();

    statusLabel.textContent = "Prefix removed.";

    // Refresh prefix list display
    await displaySavedNamePrefixes();
    await delay(1500);
    statusLabel.textContent = "";
};

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
const displaySavedNamePrefixes = async function () {
    // Clear list display
    [...prefixList.childNodes].forEach(child => prefixList.removeChild(child));
    // Get latest list and create items from them, with event handlers
    const savedNamePrefixes = (await getPrefixes())
        .map(prefix => {
            const li = document.createElement("li");
            const prefixSpan = document.createElement("span");
            prefixSpan.appendChild(document.createTextNode(`${prefix}`));
            const removeButton = document.createElement("button");
            removeButton.appendChild(document.createTextNode("Remove"));
            removeButton.addEventListener("click", removePrefixClick);
            li.appendChild(prefixSpan);
            li.appendChild(removeButton);
            return li;
        });
    // Display new list of items
    savedNamePrefixes.forEach(li => prefixList.appendChild(li));
}

addNewPrefixButton.addEventListener("click", addNewPrefixButtonClick);
document.addEventListener('DOMContentLoaded', displaySavedNamePrefixes);
document.addEventListener('DOMContentLoaded', setMicrosoftDocsAndLearnDefaultPrefixes);
