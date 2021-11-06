const storageSyncGetAsync = function (keysAndDefaults) {
    const gotValue = new Promise((resolve, reject) => {
        chrome.storage.sync.get(
            keysAndDefaults, // NOTE: `null` will get entire contents of storage
            function (result) {
                // Keys could be a string or an array of strings (or any object to get back an empty result, or null to get all of cache).
                // Unify to an array regardless.
                const keyList = Array.isArray(keysAndDefaults) ? [...keysAndDefaults] : [keysAndDefaults];
                for (var keyIndex in keyList) {
                    const key = keyList[keyIndex];
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
const getPrefixes = async function () {
    const currentSavedPrefixes = await storageSyncGetAsync(
        {
            namePrefixes: []
        }
    );
    console.log(currentSavedPrefixes);
    return currentSavedPrefixes.namePrefixes;
};
const setMicrosoftDocsAndLearnDefaultPrefixes = async function (listNode) {
    const hasSetCustomPrefixes = await getHasSetCustomPrefixes();
    if (!hasSetCustomPrefixes) {
        const currentPrefixes = await getPrefixes();
        if (currentPrefixes.length !== 0) {
            return;
        }

        console.log({status: `Setting up defaults prefix...`});

        // Set up MicrosoftDocs defaults
        const microsoftDocsDefaultPrefixes = [
            "opbld",
            "PRMerger",
            "acrolinxatmsft"
        ];
        await storageSyncSetAsync({ namePrefixes: microsoftDocsDefaultPrefixes });

        console.log({status: `Defaults set. Updating list...`});
        await displaySavedNamePrefixes(listNode);
        console.log({status: `List refreshed.`});

        await delay(1500);
        statusLabel.textContent = "";
    }
};
const displaySavedNamePrefixes = async function (listNode) {
    // Clear list display
    [...listNode.childNodes].forEach(child => listNode.removeChild(child));
    // Get latest list and create items from them
    const savedNamePrefixes = (await getPrefixes())
        .map(prefix => {
            const li = document.createElement("li");
            const prefixSpan = document.createElement("span");
            prefixSpan.appendChild(document.createTextNode(`${prefix}`));
            li.appendChild(prefixSpan);
            return li;
        });
    // Display new list of items
    savedNamePrefixes.forEach(li => listNode.appendChild(li));
}

const getAutoHideEnabledSetting = async function () {
    const autoHideSetting = (await storageSyncGetAsync({ isAutoHideEnabled: true })).isAutoHideEnabled;
    return autoHideSetting;
};
const displayAutoHideSetting = async function (settingCheckbox) {
    const currentAutoHideSetting = await getAutoHideEnabledSetting();
    settingCheckbox.checked = currentAutoHideSetting;
};

const getCurrentTab = async function () {
    const queryOptions = { active: true, currentWindow: true };
    const [tab] = await chrome.tabs.query(queryOptions);
    return tab;
};

document.addEventListener('DOMContentLoaded', async function () {
    const prefixList = document.getElementById("namePrefixes");
    const autoHideCommentsCheckbox = document.getElementById("autoHideComments");

    await setMicrosoftDocsAndLearnDefaultPrefixes(prefixList);
    await displaySavedNamePrefixes(prefixList);
    await displayAutoHideSetting(autoHideCommentsCheckbox);

    // Send message that session auto-hide toggle has changed.
    autoHideCommentsCheckbox.addEventListener("change", async function (element) {
        const tab = await getCurrentTab();
        chrome.tabs.sendMessage(
            tab.id,
            {
                method: "autoHideSessionSetting",
                data: {
                    autoHideSession: autoHideCommentsCheckbox.checked
                }
            },
            function (response) {
                if (!response || !response.result) {
                    console.log("DEBUG: 'autoHideSessionSetting' sent message result was invalid", response);
                }
                else if (response.result === "error") {
                    console.error("'autoHideSessionSetting' failed", response);
                }
                else {
                    console.log("Auto hide session setting change handled", response);
                }
            }
        );
    });
});
