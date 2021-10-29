// @ts-check

// TODO: It appears this entire file is executed from scratch for each button press within the extension pop-up. This can cause some excessive mutation observers and such. The end result isn't too painful, but definitely isn't ideal. This is likely because the file is executed as a content script initially/automatically and then within events for extension-popup.js.
(async function () {
    let needsFirstRun = true;
    // HACK: This was scoped within this immediately executing function to avoid the above TODO issue where the page is loaded multiple times, causing a runtime error with defining `options` repeatedly.
    // HACK: Duplicated directly from options.js until we can figure out a better code reuse strategy (modules?).
    let options = (function () {
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
                            // if (result[key]) {
                            //     console.log({status: `Cache found: [${key}]`, keys: keysAndDefaults, result });
                            // }
                            // else {
                            //     console.log({status: `Cache miss: [${key}]`, keys: keysAndDefaults });
                            // }
                        }
                        resolve(result);
                    }
                );
            });
            return gotValue;
        };
        const getAutoHideEnabledSetting = async function () {
            const autoHideSetting = (await storageSyncGetAsync({ isAutoHideEnabled: true })).isAutoHideEnabled;
            return autoHideSetting;
        };
        return {
            getAutoHideEnabledSetting,
        };
    })();

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
                        // if (result[key]) {
                        //     console.log({status: `Cache found: [${key}]`, keys: keysAndDefaults, result });
                        // }
                        // else {
                        //     console.log({status: `Cache miss: [${key}]`, keys: keysAndDefaults });
                        // }
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
        //console.log(currentSavedPrefixes);
        return currentSavedPrefixes.namePrefixes;
    };
    let botNamePrefixes = (await getPrefixes());

    const isElementHidden = (element) => {
        return element.offsetWidth === 0 && element.offsetHeight === 0;
    };

    let hideOutdatedBotCommentsTemporarily = function () {
        // If no bots are set, don't do anything.
        if (botNamePrefixes.length === 0) { return; }

        console.log("Hiding [temporarily] any available comments...");

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

    const hasAutoHideEnabled = await options.getAutoHideEnabledSetting();
    // Wrap later-called function around hiding to handle hiding elements and also resetting the debounce flag.
    const handleHideComments = function () {
        hideOutdatedBotCommentsTemporarily();
        hideCommentsCallPending = false;
    };

    // Handle first run through (and after re-triggering from extension pop-up, which is also currently a first-run [see hack comment at top]).
    let hideCommentsCallPending = false;
    if (hasAutoHideEnabled === true && needsFirstRun === true) {
        hideCommentsCallPending = true;
        setTimeout(handleHideComments, 500);
    }

    // When new items are added to the conversation timeline, re-apply the hiding process as appropriate. We blindly react to new elements being added to the discussion element, with a slight delay to allow for mass changes before running the hiding process a single time after things have settled.
    const newCommentsShownObserver = new MutationObserver(function(mutations) {
        // FUTURE: May be worth checking for hide-eligible elements being added before running this (via mutation.addedNodes.forEach, potentially). Currently running if any nodes are added to the discussion, regardless of the eligibility to hide as a bot comment.
        const mutationsWithAddedNodes = mutations.filter(mutation => mutation.addedNodes.length > 0);
        if (hasAutoHideEnabled === true
          && hideCommentsCallPending === false
          && mutationsWithAddedNodes.length > 0) {
            hideCommentsCallPending = true;
            setTimeout(handleHideComments, 500);
        }
    });
    // HACK: This observer is established early enough in the page lifecycle to be run as the first-run as well as future page mutations.
    // HACK: Also, probably need to `observer.disconnect()` at some point too.
    // WARNING: Did get an error once that the first argument, the discussion element, wasn't a Node. That may mean that the discussion wasn't loaded yet, which would be unusual for a script loaded after `DOMContentLoaded` (in extension-popup.js).
    const pullRequestDiscussionNode = document.getElementById("discussion_bucket");
    if (pullRequestDiscussionNode !== null) {
        newCommentsShownObserver.observe(document.getElementById("discussion_bucket"), {childList: true, subtree: true});
    }
    else {
        console.log("Could not find PR discussion log to observe for new comments.")
    }
})();
