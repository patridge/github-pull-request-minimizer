// @ts-check

(async function () {
    const extensionClassForTemporaryHideRestoration = "github-pr-minifier-minified";
    const extensionClassPrefixForTemproraryHideRestorationState = "minified-from-display-";

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

    const isElementHidden = (element) => {
        return element.offsetWidth === 0 && element.offsetHeight === 0;
    };

    // NOTE: Currently removed from standard functionality
    // let expandCommentHistory = function () {
    //     let expandPaging = function () {
    //         // Look for pagination buttons to click
    //         let paginationSubmitButtons = [...document.querySelectorAll(".ajax-pagination-btn")];
    //         let foundPaging = paginationSubmitButtons.some(_ => true);
    //         if (foundPaging) {
    //             // Found pagination buttons, click one and wait before firing off this function again.
    //             console.log("Loading additional comments to check...");
    //             paginationSubmitButtons.forEach(btn => btn.click()); // ? Maybe do `btn.dispatchEvent(new Event('click'));` instead, since `click` is complaining that it doesn't exist on an Element object. Or figure out how to make sure `btn` is of type Element earlier.
    //             setTimeout(expandPaging, 3000);
    //             hideOutdatedBotCommentsTemporarily();
    //         }
    //         else {
    //             // No more pagination buttons found, proceed with hiding comments.
    //             console.log("Done loading additional comments.");
    //         }
    //     };
    //     expandPaging();
    // }

    let hideOutdatedBotCommentsTemporarily = function () {
        // If no bots are set, don't do anything.
        if (botNamePrefixes.length === 0) { return; }

        let hideTimelineItem = (timelineItemInfo) => {
            // Find the part we wish to hide within the timeline item.
            if (timelineItemInfo.timelineItem) {
                let commentContentArea = timelineItemInfo.timelineItem.querySelector(".edit-comment-hide");
                if (commentContentArea === null) {
                    // Some timeline items aren't comments...skipping these.
                    return;
                }
    
                let isCommentAlreadyHidden = isElementHidden(commentContentArea);
                if (isCommentAlreadyHidden) {
                    return;
                }
    
                // Add marker CSS classes to make it easy to reverse hiding later.
                // One CSS class to indicate a comment that was hidden (easy to find all).
                commentContentArea.classList.add(extensionClassForTemporaryHideRestoration);
                // One CSS class to indicate the prior display state for accurate restoration later.
                commentContentArea.classList.add(`${extensionClassPrefixForTemproraryHideRestorationState}${getComputedStyle(commentContentArea).display}`);
                // Hide via CSS.
                commentContentArea.style.display = "none";
            }
        };

        console.log("Hiding [temporarily] any available comments...");

        var timelineItemsGroupedByAuthor = [...document.querySelectorAll(".js-timeline-item")] // find all the timeline items
        .map((timelineItem) => {
            return {
                timelineItem: timelineItem,
                foundAuthorPrefix: (() => {
                    let isTimelineItemAlreadyHidden = isElementHidden(timelineItem);

                    if (isTimelineItemAlreadyHidden) {
                        // Already hidden: return null to filter later.
                        return null;
                    }
                    let author = timelineItem.getElementsByClassName("author")[0]?.innerText;
                    let foundBotNamePrefix = botNamePrefixes.find(botNamePrefix => author?.startsWith(botNamePrefix));
                    if (!foundBotNamePrefix) {
                        // Not a bot prefix author: return null to filter later
                        return null;
                    }
                    return foundBotNamePrefix;
                })(),
                itemDate: (() => {
                    let timeElement = timelineItem.getElementsByClassName("js-timestamp")[0]?.getElementsByTagName("relative-time")[0] ?? null;
                    return timeElement && Date.parse(timeElement.getAttribute("datetime"));
                })()
            };
        })
        .filter((timelineItemInfo) => timelineItemInfo.foundAuthorPrefix !== null && timelineItemInfo.itemDate !== null)
        .groupBy((timelineItemInfo) => timelineItemInfo.foundAuthorPrefix);

        for (var itemGroup in timelineItemsGroupedByAuthor) {
            if (timelineItemsGroupedByAuthor.hasOwnProperty(itemGroup)) {
                let sortedItemsWithoutNewest = [...timelineItemsGroupedByAuthor[itemGroup]].sort((a, b) => a.itemDate - b.itemDate ).slice(0, -1);

                sortedItemsWithoutNewest.forEach(itemToHide => {
                    hideTimelineItem(itemToHide);
                });
            }
        }

        // IN PROGRESS: Fix currently minimizing _all_ rather than all but newest ("outdated").
        [...document.querySelectorAll(".js-timeline-item")] // find all the timeline items
            .forEach((timelineItem) => hideTimelineItem(timelineItem));
    };

    // NOTE: Removing auto-expansion of comments not loaded on initial page request. This means the user would need to hide comments every time they load more, but it means the page won't load potentially-massive comment histories just to hide a bunch of things.
    // TODO: We'd like to hide on first page load and then hide any newly shown applicable comments as they are shown.
    //expandCommentHistory();
    hideOutdatedBotCommentsTemporarily();
})();
