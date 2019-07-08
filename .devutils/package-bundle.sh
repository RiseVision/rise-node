#!/usr/bin/env bash

DIST=dist
NODE=dist/rise-node/source
DOCKER=dist/rise-node

echo "Creating ./dist/rise-node"

# cleanup
mkdir -p $DIST
rm -Rf $DIST/*

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
cp packages/cli/dist/rise $DIST
# copy current node_modules as cache to the node root
cp -R node_modules $NODE

echo "Packing source.tar.gz"
pushd $DOCKER || exit
tar -czf source.tar.gz source
rm -R source
popd || exit

## create rise-docker.tar.gz
pushd docker/bundle || exit

# copy docker files
cp config.json ../../$DOCKER
cp docker-compose.yml ../../$DOCKER
cp Dockerfile ../../$DOCKER
cp Dockerfile.postgres ../../$DOCKER

popd || exit

echo "Creating rise-node.tar.gz"
pushd dist || exit

tar -czf rise-node.tar.gz rise-node rise

popd || exit

# cleanup
rm -R $DOCKER

echo ""
echo "Ready:"
echo "dist/rise-node.tar.gz"
