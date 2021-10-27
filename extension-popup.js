let hideOutdatedCommentsTemporaryButton = document.getElementById('hideOutdatedCommentsTemporary');
let hideOutdatedCommentsPermanentButton = document.getElementById('hideOutdatedCommentsPermanent');
let prefixList = document.getElementById("namePrefixes");
let reshowCommentsButton = document.getElementById("reshowCommentsButton");

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

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
let displaySavedNamePrefixes = async function () {
    // Clear list display
    [...prefixList.childNodes].forEach(child => prefixList.removeChild(child));
    // Get latest list and create items from them
    let savedNamePrefixes = (await getPrefixes())
        .map(prefix => {
            let li = document.createElement("li");
            let prefixSpan = document.createElement("span");
            prefixSpan.appendChild(document.createTextNode(`${prefix}`));
            li.appendChild(prefixSpan);
            return li;
        });
    // Display new list of items
    savedNamePrefixes.forEach(li => prefixList.appendChild(li));
}

document.addEventListener('DOMContentLoaded', async function () {
    await setMicrosoftDocsAndLearnDefaultPrefixes();
    await displaySavedNamePrefixes();

    hideOutdatedCommentsTemporaryButton.addEventListener("click", function (element) {
        chrome.tabs.query(
            {
                active: true,
                currentWindow: true
            },
            function (tabs) {
                chrome.tabs.executeScript(
                    null, /* current tab (similar but likely more reliable than `tabs[0].id`) */
                    {
                        file: "comment-hide.js"
                    }
                );
            }
        );
    });
    reshowCommentsButton.addEventListener("click", function (element) {
        chrome.tabs.query(
            {
                active: true,
                currentWindow: true
            },
            function (tabs) {
                chrome.tabs.executeScript(
                    null, /* current tab (similar but likely more reliable than `tabs[0].id`) */
                    {
                        file: "comment-hide-restore.js"
                    }
                );
            }
        );
    });
});
