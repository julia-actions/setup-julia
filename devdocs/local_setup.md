# Local development

## 1. Clone the repo

```bash
git clone git@github.com:julia-actions/setup-julia.git
cd setup-julia
```

## 2. Install NodeJS

This repo pins the required NodeJS version in [`.tool-versions`](../.tool-versions).
At the time of writing, that version is `nodejs 24.13.0`.

### Using `mise` (recommended)

First, make sure that you have installed [`mise`](https://mise.jdx.dev/) on your local machine.

Then, `cd` to your clone of the repo and run the following command:

```bash
mise install
```

This will use `mise` to install the correct version of NodeJS from `.tool-versions`.

### Manual install

Instead of using `mise`, you can instead choose to install NodeJS manually.

First, check the `.tool-versions` file in this repo, and see what version of NodeJS you need. Then, install that same version of NodeJS on your local machine.

## 3. Working locally

First, `cd` to your clone of the repo. Now you can run the following commands:

```bash
npm ci

npm run build

npm run pack
```

When you are ready, you can commit your changes and push them to your PR.
