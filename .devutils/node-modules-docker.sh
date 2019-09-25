# NODE_MODULES
# `yarn install` node_modules on ubuntu
echo "Compiling native node_modules"

pushd docker/bundle || exit
docker build \
	-f Dockerfile.node_modules \
	-t node_modules \
	.
# in case smthing goes wrong use --no-cache
popd || exit

# prepare the dirs
mkdir -p node_modules.dist
mv node_modules node_modules.host
mv node_modules.dist node_modules

docker rm --force node_modules_build
docker run --name node_modules_build \
	-v $(pwd)/:/home/rise \
	node_modules
# cleanup
mv node_modules node_modules.dist
mv node_modules.host node_modules
