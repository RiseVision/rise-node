#!/usr/bin/env bash

cd /home/rise
cp -R rise_node/node_modules .
cp -R rise_node/node_modules/.bin node_modules
cp rise_node/package.json .
cp rise_node/lerna.json .
cp rise_node/yarn.lock .
#yarn install
npm rebuild
mv node_modules/* dist
# asterisk doesnt expand to hidden dirs
mv node_modules/.bin dist/.bin
