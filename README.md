# GitHub pull request comment minimizer

Minimize GitHub comment noise in your pull requests from bots using this Google Chrome extension.

Reduce the noise of repetitive bot comments in your GitHub pull requests by hiding outdated comments, keeping the focus of your pull request conversation on your contributors.

Once installed, from any GitHub pull request (currently limited to MicrosoftDocs repo bots), click the toolbar icon and select "Hide outdated bot comments". The extension will leave the latest comment from any of the defined bots, but hide any older comments.

If you ever hide a comment you need shown, you can always click "Show comment" to restore its visibility.

## Current bot name prefixes

Until this extension allows you to customize the bot name prefixes, it is set to minimize bots with the following prefixes:

* `opbld`
* `PRMerger`
* `acrolinxatmsft`

## Roadmap

Here are the current plans for upcoming releases. These are definitely subject to change as this project develops or evolves.

### v0.3+: Customization

* Allow customization of excluded bots within extension
