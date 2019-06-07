#!/usr/bin/env bash

echo "Creating /dist/rise-node"

# cleanup
mkdir -p /dist
rm -Rf dist/*

NODE=dist/rise-docker/rise-node
DOCKER=dist/rise-docker

## create rise-docker.tar.gz
mkdir -p $NODE
mkdir -p $NODE/packages/rise/logs
cp package.json $NODE
cp yarn.lock $NODE
cp lerna.json $NODE
cp docker/bundle/config.json $NODE
rsync -Rr packages/**/dist $NODE
rsync -Rr packages/**/etc $NODE
rsync -Rr packages/**/proto $NODE
rsync -Rr packages/**/schema $NODE
rsync -Rr packages/**/sql $NODE
rsync -Rr packages/**/package.json $NODE

# copy the rise manager file to the dist root
cp packages/cli/dist/rise dist
# copy current node_modules as cache to the node root
cp -R node_modules $NODE

echo "Creating rise-node.tar.gz"
pushd $DOCKER
tar -czf rise-node.tar.gz rise-node
rm -R rise-node
popd

## create rise-docker.tar.gz
echo "Creating /dist/rise-docker"
pushd docker/bundle

# copy docker files
cp config.json ../../$DOCKER
cp docker-compose.yml ../../$DOCKER
cp Dockerfile ../../$DOCKER
cp Dockerfile.postgres ../../$DOCKER

popd

echo "Creating rise-docker.tar.gz"
pushd dist

tar -czf rise-docker.tar.gz rise-docker rise

popd

# cleanup
# TODO uncomment
#rm -R $DOCKER

echo ""
echo "Ready:"
echo "dist/rise-docker.tar.gz"
