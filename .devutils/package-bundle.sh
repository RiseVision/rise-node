#!/usr/bin/env bash

echo "Creating /dist/rise-node"

# cleanup
mkdir -p /dist
rm -Rf dist/*

## create rise-docker.tar.gz
mkdir -p dist/rise-node
mkdir -p dist/rise-node/packages/rise/logs
cp package.json dist/rise-node
cp yarn.lock dist/rise-node
cp lerna.json dist/rise-node
cp docker/bundle/config.json dist/rise-node
rsync -Rr packages/**/dist dist/rise-node/
rsync -Rr packages/**/etc dist/rise-node
rsync -Rr packages/**/proto dist/rise-node
rsync -Rr packages/**/schema dist/rise-node
rsync -Rr packages/**/sql dist/rise-node
rsync -Rr packages/**/package.json dist/rise-node

# copy the rise manager file to the root
cp packages/cli/dist/rise dist
# copy current node_modules as cache
cp -R node_modules dist/rise-node

echo "Creating rise-node.tar.gz"
pushd dist
tar -czf rise-node.tar.gz rise-node rise
popd

## create rise-docker.tar.gz
echo "Creating /dist/rise-docker"
mkdir -p dist/rise-docker
pushd docker/bundle

# copy docker files
cp config.json ../../dist/rise-docker
cp docker-compose.yml ../../dist/rise-docker
cp Dockerfile ../../dist/rise-docker
cp Dockerfile.postgres ../../dist/rise-docker

popd

echo "Creating rise-docker.tar.gz"
pushd dist

cp rise-node.tar.gz rise-docker
tar -czf rise-docker.tar.gz rise-docker rise

popd

# cleanup
rm -R dist/rise-node
rm -R dist/rise-docker

echo ""
echo "Ready"
echo "- dist/rise-node.tar.gz"
echo "- dist/rise-docker.tar.gz"
