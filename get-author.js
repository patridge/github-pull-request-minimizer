function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

(async function () {
    await delay(3000);
    let msAuthorMetaTagValue = document.querySelectorAll("meta[name='ms.author']")[0].attributes["content"].value;
    let gitHubLocationLive = document.querySelectorAll("meta[name='original_ref_skeleton_git_url']")[0].attributes["content"].value;
    let gitHubLocationMaster = gitHubLocationLive.replace("/live/", "/master/");

    await navigator.clipboard.writeText(msAuthorMetaTagValue);
    // window.alert(`Copied '${msAuthorMetaTagValue}' to clipboard.`);
    window.open(gitHubLocationMaster, "_blank");
})();