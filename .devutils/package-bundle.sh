#!/usr/bin/env bash

DIST=dist
SOURCE=dist/rise-node/source
PKG=dist/rise-node

echo "Creating ./dist/rise-node"

# cleanup
mkdir -p $DIST
rm -Rf $DIST/*

## create rise-docker.tar.gz
mkdir -p $SOURCE
mkdir -p $SOURCE/packages/rise/logs
cp package.json $SOURCE
cp yarn.lock $SOURCE
cp lerna.json $SOURCE
#cp docker/bundle/config.json $SOURCE
rsync -Rr packages/**/dist $SOURCE
rsync -Rr packages/**/etc $SOURCE
rsync -Rr packages/**/proto $SOURCE
rsync -Rr packages/**/schema $SOURCE
rsync -Rr packages/**/sql $SOURCE
rsync -Rr packages/**/package.json $SOURCE

# copy the rise manager file to the dist root
cp packages/cli/dist/rise $DIST

# copy compiled node_modules as cache to the dist source
echo "Coping node_modules.dist"
cp -Rf node_modules.dist $SOURCE/node_modules

# PACKAGE SOURCE
echo "Packing source.tar.gz"
pushd $PKG || exit
tar -czf source.tar.gz source
rm -R source
popd || exit

## create rise-docker.tar.gz
pushd docker/bundle || exit

# copy docker files
cp docker-compose.yml ../../$PKG
cp Dockerfile ../../$PKG
cp Dockerfile.postgres ../../$PKG

popd || exit

echo "Creating rise-node.tar.gz"
pushd dist || exit

tar -czf rise-node.tar.gz rise-node rise

popd || exit

# cleanup
#rm -R $PKG

echo ""
echo "Ready:"
echo "dist/rise-node.tar.gz"
