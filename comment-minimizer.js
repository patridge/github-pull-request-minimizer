(async function () {
    if (!Array.prototype.groupBy) {
        Array.prototype.groupBy = function (keyDefiner) {
            return this.reduce(function(store, item) {
                let key = keyDefiner(item);
                let value = store[key] || [];
                store[key] = value.concat([item]);
                return store;
            }, {})
        };
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
    let getPrefixes = async function () {
        let currentSavedPrefixes = await storageSyncGetAsync(
            {
                namePrefixes: []
            }
        );
        console.log(currentSavedPrefixes);
        return currentSavedPrefixes.namePrefixes;
    };
    let botNamePrefixes = (await getPrefixes());

    let expandCommentHistory = function () {
        let expandPaging = function () {
            // Look for pagination buttons to click
            let paginationSubmitButtons = [...document.querySelectorAll(".ajax-pagination-btn")];
            let foundPaging = paginationSubmitButtons.some(_ => true);
            if (foundPaging) {
                // Found pagination buttons, click one and wait before firing off this function again.
                console.log("Loading additional comments to check...");
                paginationSubmitButtons.forEach(btn => btn.click());
                setTimeout(expandPaging, 3000);
                hideOutdatedBotComments();
            }
            else {
                // No more pagination buttons found, proceed with hiding comments.
                console.log("Done loading additional comments.");
            }
        };
        expandPaging();
    }

    let hideOutdatedBotComments = function () {
        // If no bots are set, don't do anything.
        if (botNamePrefixes.length === 0) { return; }

        console.log("Hiding any available comments...");
        let groupedItemsToProcess = [...document.querySelectorAll(".js-comment-hide-button")] // find all the hide buttons (auto-excludes initial PR "comment" that is also a .TimelineItem element)
            .map((button) => { // Get the nearest timeline item
                let timelineItem = button.closest(".js-timeline-item");
                return {
                    timelineItem: timelineItem,
                    commentHideButton: button,
                    foundAuthorPrefix: (() => {
                        let isTimelineItemAlreadyHidden = [...timelineItem.getElementsByClassName("minimized-comment")].some(element => element.offsetWidth > 0 && element.offsetHeight > 0);

                        if (isTimelineItemAlreadyHidden) {
                            // Already showing minimized message: return null to filter later
                            return null;
                        }
                        let author = timelineItem.getElementsByClassName("author")[0].innerText;
                        let foundBotNamePrefix = botNamePrefixes.find(botNamePrefix => author.startsWith(botNamePrefix));
                        if (!foundBotNamePrefix) {
                            // Not a bot prefix author: return null to filter later
                            return null;
                        }
                        return foundBotNamePrefix;
                    })(),
                    itemDate: (() => {
                        return Date.parse(timelineItem.getElementsByClassName("js-timestamp")[0].getElementsByTagName("relative-time")[0].getAttribute("datetime"));
                    })()
                };
            })
            .filter((historyItem) => historyItem.foundAuthorPrefix !== null)
            .groupBy((historyItem) => historyItem.foundAuthorPrefix);

        for (var itemGroup in groupedItemsToProcess) {
            if (groupedItemsToProcess.hasOwnProperty(itemGroup)) {
                let sortedItemsWithoutNewest = [...groupedItemsToProcess[itemGroup]].sort(function (a, b) { a.itemDate - b.itemDate }).slice(0, -1);
                sortedItemsWithoutNewest.forEach(itemToHide => {
                    // form.js-comment-minimize
                    let commentHideForm = itemToHide.timelineItem.getElementsByClassName("js-comment-minimize")[0];
                    // > select[name="classifier"]
                    let commentHideReasonSelect = [...commentHideForm.getElementsByTagName("select")].filter(e => e.getAttribute("name") === "classifier")[0];
                    // > button.btn[type="submit"]
                    let commentHideSubmitButton = [...commentHideForm.getElementsByTagName("button")].filter(e => e.classList.contains("btn") && e.getAttribute("type") === "submit")[0];

                    // itemToHide.timelineItem.style.border = "1px solid red";
                    itemToHide.commentHideButton.click();

                    // select: option[value="OUTDATED"]
                    commentHideReasonSelect.value = "OUTDATED";
                    // Submit form with button.click()
                    commentHideSubmitButton.click();
                });
            }
        }
    };

    hideOutdatedBotComments();
    expandCommentHistory();
})();
