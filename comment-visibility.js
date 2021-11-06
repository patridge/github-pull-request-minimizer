// @ts-check

(async function () {
    // HACK: Duplicated directly from options.js until we can figure out a better code reuse strategy (modules?).
    const options = (function () {
        const storageSyncGetAsync = function (keysAndDefaults) {
            const gotValue = new Promise((resolve, reject) => {
                chrome.storage.sync.get(
                    keysAndDefaults, // NOTE: `null` will get entire contents of storage
                    function (result) {
                        // Keys could be a string or an array of strings (or any object to get back an empty result, or null to get all of cache).
                        // Unify to an array regardless.
                        const keyList = Array.isArray(keysAndDefaults) ? [...keysAndDefaults] : [keysAndDefaults];
                        for (var keyIndex in keyList) {
                            var key = keyList[keyIndex];
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
        const getPrefixes = async function () {
            const currentSavedPrefixes = await storageSyncGetAsync(
                {
                    namePrefixes: []
                }
            );
            return currentSavedPrefixes.namePrefixes;
        };
        return {
            getAutoHideEnabledSetting,
            getPrefixes,
        };
    })();
    let botNamePrefixes = (await options.getPrefixes());
    let autoHideOptionSetting = (await options.getAutoHideEnabledSetting());
    let autoHideSessionSetting = null;
    const shouldHideComments = () => {
        return (autoHideSessionSetting ?? autoHideOptionSetting);
    };

    const extensionClassForTemporaryHideRestoration = "github-pr-minifier-minified";
    const extensionClassPrefixForTemproraryHideRestorationState = "minified-from-display-";

    if (!Array.prototype.groupBy) {
        Array.prototype.groupBy = function (keyDefiner) {
            return this.reduce(function(store, item) {
                const key = keyDefiner(item);
                const value = store[key] || [];
                store[key] = value.concat([item]);
                return store;
            }, {})
        };
    }

    const hideEligibleCommentsForSession = function () {
        const isElementHidden = (element) => {
            return element.offsetWidth === 0 && element.offsetHeight === 0;
        };

        // If no bots are set, don't do anything.
        if (botNamePrefixes.length === 0) { return; }

        if (shouldHideComments() === false) {
            return;
        }

        console.log("Hiding eligible comments for session...");

        const hideTimelineItem = (timelineItemInfo) => {
            // Find the part we wish to hide within the timeline item.
            if (timelineItemInfo.timelineItem) {
                const commentContentArea = timelineItemInfo.timelineItem.querySelector(".edit-comment-hide");
                if (commentContentArea === null) {
                    // Some timeline items aren't comments...skipping these.
                    return;
                }

                const isCommentAlreadyHidden = isElementHidden(commentContentArea);
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

        const timelineItemsGroupedByAuthor = [...document.querySelectorAll(".js-timeline-item")] // find all the timeline items
        .map((timelineItem) => {
            return {
                timelineItem: timelineItem,
                foundAuthorPrefix: (() => {
                    const isTimelineItemAlreadyHidden = isElementHidden(timelineItem);
    
                    if (isTimelineItemAlreadyHidden) {
                        // Already hidden: return null to filter later.
                        return null;
                    }
                    const author = timelineItem.getElementsByClassName("author")[0]?.innerText;
                    const foundBotNamePrefix = botNamePrefixes.find(botNamePrefix => author?.startsWith(botNamePrefix));
                    if (!foundBotNamePrefix) {
                        // Not a bot prefix author: return null to filter later
                        return null;
                    }
                    return foundBotNamePrefix;
                })(),
                itemDate: (() => {
                    const timeElement = timelineItem.getElementsByClassName("js-timestamp")[0]?.getElementsByTagName("relative-time")[0] ?? null;
                    return timeElement && Date.parse(timeElement.getAttribute("datetime"));
                })()
            };
        })
        .filter((timelineItemInfo) => timelineItemInfo.foundAuthorPrefix !== null && timelineItemInfo.itemDate !== null)
        .groupBy((timelineItemInfo) => timelineItemInfo.foundAuthorPrefix);

        for (var itemGroup in timelineItemsGroupedByAuthor) {
            if (timelineItemsGroupedByAuthor.hasOwnProperty(itemGroup)) {
                const sortedItemsWithoutNewest = [...timelineItemsGroupedByAuthor[itemGroup]].sort((a, b) => a.itemDate - b.itemDate ).slice(0, -1);

                sortedItemsWithoutNewest.forEach(itemToHide => {
                    hideTimelineItem(itemToHide);
                });
            }
        }
    };
    const restoreAllHiddenComments = function () {
        console.log("Restoring any temporarily hidden comments...");
        [...document.getElementsByClassName(extensionClassForTemporaryHideRestoration)] // find all the comment areas hidden previously
            .forEach((hiddenComment) => {
                let hiddenCommentPriorDisplayStateClass = [...hiddenComment.classList].find(className => className.startsWith(extensionClassPrefixForTemproraryHideRestorationState));
                if (hiddenCommentPriorDisplayStateClass === null || hiddenCommentPriorDisplayStateClass === "") {
                    // Found it with class but didn't find prior state...skip this one and remove class.
                    hiddenComment.classList.remove(extensionClassForTemporaryHideRestoration);
                    return;
                }

                let priorDisplayStyle = hiddenCommentPriorDisplayStateClass.substring(extensionClassPrefixForTemproraryHideRestorationState.length);
                // Re-show via CSS.
                hiddenComment.style.display = priorDisplayStyle;
                // Remove hidden comment classes going forward.
                hiddenComment.classList.remove(extensionClassForTemporaryHideRestoration);
                hiddenComment.classList.remove(hiddenCommentPriorDisplayStateClass);
            });
    };

    let hideCommentsCallPending = false;
    // Wrap later-called function around hiding to handle hiding elements and also resetting the debounce flag.
    const handleHideComments = function () {
        hideEligibleCommentsForSession();
        hideCommentsCallPending = false;
    };
    let showCommentsCallPending = false;
    // Wrap later-called function around hiding to handle hiding elements and also resetting the debounce flag.
    const handleRestoreComments = function () {
        restoreAllHiddenComments();
        showCommentsCallPending = false;
    };

    // Handle first run through.
    // NOTE: Shouldn't ever need to call `handleRestoreComments` on first load.
    if (shouldHideComments() === true) {
        hideCommentsCallPending = true;
        setTimeout(handleHideComments, 500);
    }

    // When new items are added to the conversation timeline, re-apply the hiding process as appropriate. We blindly react to new elements being added to the discussion element, with a slight delay to allow for mass changes before running the hiding process a single time after things have settled.
    const newCommentsShownObserver = new MutationObserver(function(mutations) {
        // FUTURE: May be worth checking for hide-eligible elements being added before running this (via mutation.addedNodes.forEach, potentially). Currently running if any nodes are added to the discussion, regardless of the eligibility to hide as a bot comment.
        const mutationsWithAddedNodes = mutations.filter(mutation => mutation.addedNodes.length > 0);
        if (shouldHideComments() === true
            && hideCommentsCallPending === false
            && mutationsWithAddedNodes.length > 0) {
            hideCommentsCallPending = true;
            setTimeout(handleHideComments, 500);
        }
    });
    // HACK: Also, probably need to `observer.disconnect()` at some point too.
    const pullRequestDiscussionNode = document.getElementById("discussion_bucket");
    if (pullRequestDiscussionNode !== null) {
        newCommentsShownObserver.observe(pullRequestDiscussionNode, {childList: true, subtree: true});
    }
    else {
        // TODO: This error happens during interstitial team authorization display when the URL matches the desired pattern but it shows the auth request rather than the actual PR content.
        console.log("Could not find PR discussion log to observe for new comments.")
    }

    const handleCommentVisibility = function () {
        const autoHideSetting = shouldHideComments();
        // Toggle show/hide of bot comments based on message data.
        if (autoHideSetting === true) {
            handleHideComments();
        }
        else {
            handleRestoreComments();
        }
    };

    // Listen for changes to the auto-hide toggle extension option.
    chrome.storage.onChanged.addListener(async function (changes, namespace) {
        for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
            switch (key) {
                case "namePrefixes":
                    botNamePrefixes = (await options.getPrefixes());
                    break;
                case "isAutoHideEnabled":
                    autoHideOptionSetting = (await options.getAutoHideEnabledSetting());
                    handleCommentVisibility();
                    break;
            }
        }
    });

    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        switch (request.method) {
            case "autoHideSessionSetting":
                autoHideSessionSetting = request?.data?.autoHideSession;
                handleCommentVisibility();
                
                sendResponse(
                    {
                        result: "handled"
                    }
                );
                break;
            default:
                console.log(`Unknown message received: ${request.method}`);
                break;
        }
    });
})();
