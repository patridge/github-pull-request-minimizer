let hideOutdatedCommentsButton = document.getElementById('hideOutdatedComments');

hideOutdatedCommentsButton.onclick = function(element) {
    chrome.tabs.query(
        {
            active: true,
            currentWindow: true
        },
        function(tabs) {
            chrome.tabs.executeScript(
                tabs[0].id,
                {
                    code: 'console.log("Hiding old bot comments..."); commentMinimizer.hideOutdatedBotComments();'
                }
            );
        }
    );
};
