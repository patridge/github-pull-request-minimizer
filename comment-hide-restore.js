// @ts-check

(async function () {
    const extensionClassForTemporaryHideRestoration = "github-pr-minifier-minified";
    const extensionClassPrefixForTemproraryHideRestorationState = "minified-from-display-";

    let restoreOutdatedBotCommentsHiddenTemporarily = function () {
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

    restoreOutdatedBotCommentsHiddenTemporarily();
})();
