#!/bin/bash

root=$(pwd)

timestamp() { date "+%H:%M:%S"; }

# Get packages in topology order
pkgs=($(yarn -s lerna --sort exec "echo \$LERNA_PACKAGE_NAME"))

for pkg in "${pkgs[@]}"; do
    echo "[$(timestamp)] Transpiling & watching $pkg"


    yarn workspace $pkg -s test-unit
    [ $? -ne 0 ] && exit 1
done

echo "[$(timestamp)] All packages tested"
wait
