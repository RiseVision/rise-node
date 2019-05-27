#!/usr/bin/env bash

echo "Creating rise-node.tar.gz"
rm docker/bundle/rise-node.tar.gz
rm docker/bundle/rise-docker.tar.gz

## create the inner package
tar -cf rise-node.tar package.json
# append
tar -rf rise-node.tar lerna.json
tar -rf rise-node.tar packages/**/dist
tar -rf rise-node.tar packages/**/etc
tar -rf rise-node.tar packages/**/schema
tar -rf rise-node.tar packages/**/package.json
# move to docker
mv -f rise-node.tar docker/bundle

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
echo "Adding node_modules to rise-node.tar"

pushd docker/bundle
tar -rf rise-node.tar node_modules
rm -R node_modules

## gzip the result
gzip rise-node.tar


## create the outer package
echo "Creating rise-docker.tar.gz"
tar -cf rise-docker.tar config.json
tar -rf rise-docker.tar docker-compose.yml
tar -rf rise-docker.tar Dockerfile
tar -rf rise-docker.tar Dockerfile.postgres
tar -rf rise-docker.tar rise-node.tar.gz
gzip rise-docker.tar

echo "Ready"
echo "- docker/rise-node.tar.gz"
echo "- docker/rise-docker.tar.gz"
