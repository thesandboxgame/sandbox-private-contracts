[1mdiff --git a/docs/tutorials/writing-documentation.md b/docs/tutorials/writing-documentation.md[m
[1mindex f01694a2..8436b76b 100644[m
[1m--- a/docs/tutorials/writing-documentation.md[m
[1m+++ b/docs/tutorials/writing-documentation.md[m
[36m@@ -2,7 +2,7 @@[m
 description: Writing documentation[m
 ---[m
 [m
[31m-# Writing documentation[m
[32m+[m[32m# How to write a documentation[m
 [m
 ## Prerequisites[m
 [m
[36m@@ -11,6 +11,12 @@[m [mdescription: Writing documentation[m
 * [Material for MkDocs](https://squidfunk.github.io/mkdocs-material/)[m
 * [PlantUML Extension for Python-Markdown](https://github.com/mikitex70/plantuml-markdown)[m
 [m
[32m+[m[32m## Introduction[m
[32m+[m
[32m+[m[32m[MkDocs](https://www.mkdocs.org/) is a fast, simple and downright gorgeous static site generator that's geared towards building project documentation from Markdown files.[m
[32m+[m
[32m+[m[32m[Read the Docs](https://readthedocs.org/) is a service that automates building, versioning, and hosting of your docs for you.[m
[32m+[m
 ## Install[m
 [m
 All requirements are declared in the `docs/requirements.txt` file.[m
[36m@@ -26,3 +32,74 @@[m [mCheck that MkDocs is installed with:[m
 ```shell[m
 mkdocs -V[m
 ```[m
[32m+[m
[32m+[m[32m## Start MkDocs[m
[32m+[m
[32m+[m[32mStart to host the documentation with the following command:[m
[32m+[m[32m```shell[m
[32m+[m[32mmkdocs serve[m
[32m+[m[32m```[m
[32m+[m
[32m+[m[32mThe documentation is built and then served at the address[m
[32m+[m[32m[http://127.0.0.1:8000/](http://127.0.0.1:8000/)[m
[32m+[m
[32m+[m[32mMkDocs detects file changes in the documentation, rebuild it and reload the browser automatically.[m
[32m+[m
[32m+[m[32m## Configuration[m
[32m+[m
[32m+[m[32mThere are two main configuration files:[m
[32m+[m
[32m+[m[32m- `.readthedocs.yaml`: configuration for the service [Read the Docs](https://readthedocs.org/) to know how to build the documentation with MkDocs[m
[32m+[m[32m- `.mkdocs.yaml`: configuration of [MkDocs](https://www.mkdocs.org/) for the documentation (navigation, extensions, theme, etc)[m
[32m+[m
[32m+[m[32mThe documentation files are located in the folder `docs`.[m
[32m+[m
[32m+[m[32mThe theme used for this documentation is [Material for MkDocs](https://squidfunk.github.io/mkdocs-material/) which comes with very handy tools.[m
[32m+[m
[32m+[m[32m## Adding a page[m
[32m+[m
[32m+[m[32mLet's add a page into the folder with my new documentation[m
[32m+[m
[32m+[m[32m```shell[m
[32m+[m[32mtouch docs/howto/my-page.md[m
[32m+[m[32m```[m
[32m+[m
[32m+[m[32mAnd then, in `.mkdocs.yml`, let's add the page to the howto menu[m
[32m+[m
[32m+[m[32m```yaml[m
[32m+[m[32mnav:[m
[32m+[m[32m  - How to:[m
[32m+[m[32m      - Fixing tests: howto/fixing-tests.md[m
[32m+[m[32m      - My page: howto/my-page.md[m
[32m+[m[32m```[m
[32m+[m
[32m+[m[32mCheckout your page at the address[m
[32m+[m
[32m+[m[32m[http://127.0.0.1:8000/howto/my-page/](http://127.0.0.1:8000/howto/my-page/)[m
[32m+[m
[32m+[m[32m## Content supported[m
[32m+[m
[32m+[m[32mThis documentation supports:[m
[32m+[m
[32m+[m[32m- MkDocs supports [Markdown](https://daringfireball.net/projects/markdown/) language.[m
[32m+[m[32m- The Markdown extensions of Material for MkDocs like [admonitions](https://squidfunk.github.io/mkdocs-material/reference/admonitions/)[m
[32m+[m
[32m+[m[32m!!! note[m
[32m+[m[32m    Awesome![m
[32m+[m
[32m+[m[32m- [PlantUML](https://plantuml.com/) diagrams[m
[32m+[m
[32m+[m[32m```plantuml[m
[32m+[m
[32m+[m[32mactor BradPitt[m
[32m+[m
[32m+[m[32mentity A[m
[32m+[m[32mentity B[m
[32m+[m
[32m+[m[32mBradPitt -> A: Do stuff[m
[32m+[m
[32m+[m[32m```[m
[32m+[m
[32m+[m[32m## Deployment[m
[32m+[m
[32m+[m[32mOnce your branch is merged into master, a [webhook](https://github.com/thesandboxgame/sandbox-smart-contracts/settings/hooks) is called by Github on Read the Docs to trigger the generation of the documentation.[m
