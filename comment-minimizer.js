(function() {
    // Any comments by a username that starts with any of the following strings will be eligible for hiding of old comments. These are the defaults, ones used in MicrosoftDocs repos.
    const botNamePrefixes = [
        "opbld",
        "PRMerger",
        "acrolinxatmsft"
    ];

    let hideOutdatedBotComments = function () {
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
})();
