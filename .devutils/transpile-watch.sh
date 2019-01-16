#!/bin/bash

root=$(pwd)

timestamp() { date "+%H:%M:%S"; }

# Get packages in topology order
pkgs=($(yarn -s lerna --sort exec "echo \$LERNA_PACKAGE_NAME"))

# Run in a sub-shell to make Ctrl-C work
(
    trap 'kill 0' SIGINT
    set -e

    for pkg in "${pkgs[@]}"; do
        echo "[$(timestamp)] Transpiling & watching $pkg"

        pkg="${pkg#"@risevision/"}"
        rm -fr $root/packages/$pkg/dist
        yarn -s tsc -w -p $root/packages/$pkg &

        # Wait for the compilation to succeed before continuing
        while [ ! -f $root/packages/$pkg/dist/index.js ]; do sleep 0.2; done
    done

    echo "[$(timestamp)] All packages transpiled"
    wait
)
