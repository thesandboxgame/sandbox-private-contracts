---
description: Developing your first feature
---

# Developing your first feature

## Development tools

* [Jira](https://sandboxgame.atlassian.net) for project management with a [Kanban board](https://sandboxgame.atlassian.net/secure/RapidBoard.jspa?projectKey=TSBBLOC&rapidView=68)
* [Github](https://github.com/thesandboxgame/sandbox-smart-contracts) for the source code & peer reviews
* [Github actions](https://github.com/thesandboxgame/sandbox-smart-contracts/actions) for the continuous integration

## Development process

### Update the ticket

Connect to the [Jira board](https://sandboxgame.atlassian.net/secure/RapidBoard.jspa?projectKey=TSBBLOC&rapidView=68) of the Sandbox Blockchain Team.
Select your ticket and move it to the `In Progress` status.

!!! tip
    If the ticket is not clear, don't hesitate to write a comment

### Create a branch & a pull request

#### With Jira (Recommended)

The recommended way to create a branch associated to a ticket is to use the Git integration plugin on Jira.
Edit your ticket and on the menu, select `Open Git Integration`, it auto-selects the name of the branch based on the name of the ticket.
Click the button `Create branch` to create a branch for this ticket.
Repeat the same process to create a WIP (draft) pull request.

#### With git

If the jira plugin is inactive, you can still create a branch using git in a terminal.
The branch name has to start with the name of the ticket. Don't forget to create your branch from master.

!!! example
    ```shell
    git checkout master
    git pull
    git checkout -b TSBBLOC-xxx-name-of-your-branch
    ```

### Checkout the branch

Now you're ready to checkout the branch in your repository

!!! example
    ```shell
    git checkout TSBBLOC-xxx-name-of-your-branch
    ```

### Developing & testing your feature

For good measure, before any changes, verify that the [tests run successfully](../intro/running-tests.md).

After introducing your changes, don't forget to run the tests and fix the potentials errors.
If you've added a new contract, add a test file to cover it.

### Pushing your code

When you're done with your feature, commit with a descriptive comment and push your code to the origin

!!! example
    ```shell
    git add .
    git commit -m "your comment"
    git push
    ```

### Continuous integration

Automatically, [Github Actions](https://github.com/thesandboxgame/sandbox-smart-contracts/actions) run the tests after a new commit, merge or branch.
If your branch doesn't successfully run the tests, go back locally [to fix it](../howto/fixing-tests.md).

!!! bug "Running tests with [Mocha extension](../intro/running-tests.md#running-the-tests-with-visual-studio-code)"
    Be careful, we had cases in the past where the tests would pass on the command line and the CI but not with the Mocha extension

### Peer review

Once the tests are successful, and the feature ready:

* on Jira, select the ticket and move it to the `Peer review` status
* on Github, remove the draft tag from the pull request and ask for review
* reply to the eventual comments, [apply the needed changes](developing-first-feature.md#developing--testing-your-feature)
* submit again the pull request to the reviewer

### Merging the pull request

Once the PR approved by the reviewer, the developer or the reviewer are able to merge the PR into the master branch.
The developer moves the ticket to the `Ready for audit` if it is about a new smart contract that needs an audit.
Otherwise, the ticket can be move to `Done`.

!!! info
    Don't forget to clean the branch once merged.
