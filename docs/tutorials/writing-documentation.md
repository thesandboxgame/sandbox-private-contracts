---
description: Writing documentation
---

# How to write a documentation

## Prerequisites

* [Python](https://www.python.org/downloads/)
* [MkDocs](https://www.mkdocs.org/)
* [Material for MkDocs](https://squidfunk.github.io/mkdocs-material/)
* [PlantUML Extension for Python-Markdown](https://github.com/mikitex70/plantuml-markdown)

## Introduction

[MkDocs](https://www.mkdocs.org/) is a fast, simple and downright gorgeous static site generator that's geared towards building project documentation from Markdown files.

[Read the Docs](https://readthedocs.org/) is a service that automates building, versioning, and hosting of your docs for you.

## Install

All requirements are declared in the `docs/requirements.txt` file.

Once python is installed, use the following command to install the others requirements with pip.

```shell
pip install -r docs/requirements.txt
```

Check that MkDocs is installed with:

```shell
mkdocs -V
```

## Start MkDocs

Start to host the documentation with the following command:
```shell
mkdocs serve
```

The documentation is built and then served at the address
[http://127.0.0.1:8000/](http://127.0.0.1:8000/)

MkDocs detects file changes in the documentation, rebuild it and reload the browser automatically.

## Configuration

There are two main configuration files:

- `.readthedocs.yaml`: configuration for the service [Read the Docs](https://readthedocs.org/) to know how to build the documentation with MkDocs
- `.mkdocs.yaml`: configuration of [MkDocs](https://www.mkdocs.org/) for the documentation (navigation, extensions, theme, etc)

The documentation files are located in the folder `docs`.

The theme used for this documentation is [Material for MkDocs](https://squidfunk.github.io/mkdocs-material/) which comes with very handy tools.

## Adding a page

Let's add a page into the folder with my new documentation

```shell
touch docs/howto/my-page.md
```

And then, in `.mkdocs.yml`, let's add the page to the howto menu

```yaml
nav:
  - How to:
      - Fixing tests: howto/fixing-tests.md
      - My page: howto/my-page.md
```

Checkout your page at the address

[http://127.0.0.1:8000/howto/my-page/](http://127.0.0.1:8000/howto/my-page/)

## Content supported

This documentation supports:

- MkDocs supports [Markdown](https://daringfireball.net/projects/markdown/) language.
- The Markdown extensions of Material for MkDocs like [admonitions](https://squidfunk.github.io/mkdocs-material/reference/admonitions/)

!!! note
    Awesome!

- [PlantUML](https://plantuml.com/) diagrams

```plantuml

actor BradPitt

entity A
entity B

BradPitt -> A: Do stuff

```

## Deployment

Once your branch is merged into master, a [webhook](https://github.com/thesandboxgame/sandbox-smart-contracts/settings/hooks) is called by Github on Read the Docs to trigger the generation of the documentation.
