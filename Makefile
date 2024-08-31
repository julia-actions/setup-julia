.NOTPARALLEL:

# This is the default target:
.PHONY: pack
pack: build
	npm run pack

# ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

.PHONY: everything-from-scratch
everything-from-scratch: cleanall install-packages build pack clean

# build does `npm run build`, but does not run `npm run pack`
.PHONY: build
build:
	npm run build

.PHONY: test
test:
	npm run test

.PHONY: install-packages
install-packages:
	rm -rf node_modules/
	# Note: we use `npm ci` instead of `npm install`, because we want to make sure
	# that we respect the versions in the `package-lock.json` lockfile.
	npm ci

# ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

.PHONY: clean
clean:
	rm -rf node_modules/

.PHONY: cleanall
cleanall: clean
	rm -rf lib/
	rm -rf dist/

# ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

# asdf does not support Windows.
# On Windows, users need to install the correct version of NodeJS themselves.
.PHONY: unix-asdf-install
unix-asdf-install:
	asdf plugin add nodejs # update this list when we add more tools to `.tool-versions`
	asdf install

# +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
