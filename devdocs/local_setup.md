# Local development

## 1. Clone the repo

```bash
git clone git@github.com:julia-actions/setup-julia.git
cd setup-julia
```

## 2. Install NodeJS

### Unix, using `asdf` (recommended, but not required)

First, make sure that you have installed [`asdf`](https://asdf-vm.com/) on your local machine.

Then, `cd` to your clone of the repo and run the following commands:

```bash
asdf plugin add nodejs
asdf install
```

This will use `asdf` to install the correct version of NodeJS.

### Unix, but not using `asdf`

Instead of using `asdf`, you can instead choose to install NodeJS manually.

First, check the `.tool-versions` file in this repo, and see what version of NodeJS you need. Then, install that same version of NodejS on your local machine.

### Windows

`asdf` does not (currently) support Windows. So on Windows, you have to install NodeJS manually.

First, check the `.tool-versions` file in this repo, and see what version of NodeJS you need. Then, install that same version of NodejS on your local machine.

## 3. Working locally

First, `cd` to your clone of the repo. Now you can run the following commands:

```bash
npm ci

npm run build

npm run pack
```

When you are ready, you can commit your changes and push them to your PR.
