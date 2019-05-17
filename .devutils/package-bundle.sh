#!/usr/bin/env bash

#RUN ./node_modules/.bin/lerna run transpile && \
#    ./node_modules/.bin/lerna bootstrap && \
#    ./node_modules/.bin/lerna link

#tar -cf myfile.tar foo
#tar -rf myfile.tar test/**/build
#tar -tf myfile.tar

# create
tar -cf rise.tar node_modules
# append
tar -rf rise.tar package.json
tar -rf rise.tar packages/**/dist
tar -rf rise.tar packages/**/package.json
# move to docker
mv -f rise.tar docker/bundle
