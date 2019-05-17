#!/usr/bin/env bash

echo "Creating rise.tar"
rm docker/bundle/rise.tar

## create
tar -cf rise.tar package.json
# append
tar -rf rise.tar lerna.json
tar -rf rise.tar packages/**/dist
tar -rf rise.tar packages/**/etc
tar -rf rise.tar packages/**/schema
tar -rf rise.tar packages/**/package.json
# move to docker
mv -f rise.tar docker/bundle

## compile native node_modules
echo "Compiling native node_modules"

pushd docker/bundle
docker build \
	-f Dockerfile.node_modules \
	-t node_modules \
	.
mkdir -p node_modules
popd

docker rm --force node_modules_build
docker run --name node_modules_build \
	-v $(pwd)/:/home/rise/rise_node \
	-v $(pwd)/docker/bundle/node_modules:/home/rise/dist \
	node_modules

## append rebuild node_modules to the archive
echo "Adding node_modules to rise.tar"

pushd docker/bundle
tar -rf rise.tar node_modules
rm -R node_modules
popd
