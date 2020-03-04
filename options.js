// TODO: Offer options button from main pop-up

let newNamePrefixInput = document.getElementById("newNamePrefixInput");
let addNewPrefixButton = document.getElementById("addNewPrefixButton");
let statusLabel = document.getElementById("status");
let prefixList = document.getElementById("namePrefixes");

let delay = function (timeInMilliseconds) {
    return new Promise(resolve => setTimeout(resolve, timeInMilliseconds));
}
let storageSyncGetAsync = function (keysAndDefaults) {
    let gotValue = new Promise((resolve, reject) => {
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
let storageSyncSetAsync = function (items) {
    let setValue = new Promise((resolve, reject) => {
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

let getHasSetCustomPrefixes = async function () {
    return (await storageSyncGetAsync({ hasSetPrefixes: false })).hasSetPrefixes;
}
let setHasSetCustomPrefixes = async function () {
    await storageSyncSetAsync({ hasSetPrefixes: true });
}
let getPrefixes = async function () {
    let currentSavedPrefixes = await storageSyncGetAsync(
        {
            namePrefixes: []
        }
    );
    console.log(currentSavedPrefixes);
    return currentSavedPrefixes.namePrefixes;
};
let setMicrosoftDocsAndLearnDefaultPrefixes = async function () {
    let hasSetCustomPrefixes = await getHasSetCustomPrefixes();
    if (!hasSetCustomPrefixes) {
        let currentPrefixes = await getPrefixes();
        if (currentPrefixes.length !== 0) {
            return;
        }

        statusLabel.textContent = "Setting up defaults prefix...";

        // Set up MicrosoftDocs defaults
        let microsoftDocsDefaultPrefixes = [
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

let saveNewNamePrefix = async function (namePrefix) {
    let currentSavedPrefixes = await getPrefixes();
    // Append new prefix to list
    let newPrefixesToSave = [...currentSavedPrefixes, namePrefix];
    // Save new prefix list to storage
    await storageSyncSetAsync({ namePrefixes: newPrefixesToSave });
    setHasSetCustomPrefixes();
};
let addNewPrefixButtonClick = async function(event) {
    statusLabel.textContent = "Adding prefix...";

    let newNamePrefix = newNamePrefixInput.value;
    await saveNewNamePrefix(newNamePrefix);
    newNamePrefixInput.value = "";

    statusLabel.textContent = "Prefix added. Updating list...";

    // Refresh prefix list display
    await displaySavedNamePrefixes();

    statusLabel.textContent = "List refreshed.";

    await delay(1500);
    statusLabel.textContent = "";
};

let getSiblings = function (el, filter) {
    var siblings = [];
    el = el.parentNode.firstChild;
    do { if (!filter || filter(el)) siblings.push(el); } while (el = el.nextSibling);
    return siblings;
};
let removePrefixClick = async function (event) {
    statusLabel.textContent = "Removing prefix...";

    let removeButtonSender = event.target;
    // Find adjacent text node with prefix value
    let prefixSpan = getSiblings(removeButtonSender, (sibling) => sibling.tagName.toLowerCase() === "span")[0];
    let prefixToRemove = prefixSpan.textContent;

    // Confirm removal
    let confirmed = window.confirm(`Delete '${prefixToRemove}'?`);
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
    let savedNamePrefixes = (await getPrefixes());
    // Trim out removed prefix (if found)
    let newNamePrefixes = savedNamePrefixes.filter(prefix => prefix !== prefixToRemove);
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
let displaySavedNamePrefixes = async function () {
    // Clear list display
    [...prefixList.childNodes].forEach(child => prefixList.removeChild(child));
    // Get latest list and create items from them, with event handlers
    let savedNamePrefixes = (await getPrefixes())
        .map(prefix => {
            let li = document.createElement("li");
            let prefixSpan = document.createElement("span");
            prefixSpan.appendChild(document.createTextNode(`${prefix}`));
            let removeButton = document.createElement("button");
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
document.addEventListener('DOMContentLoaded', functionsetMicrosoftDocsAndLearnDefaultPrefixes);
