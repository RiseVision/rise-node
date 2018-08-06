#!/bin/bash

inotifywait -q -m -e close_write --format "%w %e %f" -r $(ls packages | xargs -I {} echo packages/{}/src ) |
while read events; do
    echo $events;
    PACKAGE=$(echo $events | cut -d ' ' -f 1 | cut -d '/' -f2)
    echo -n "Recompiling $PACKAGE ..."
    (npm run single-transpile $PACKAGE >> /dev/null && echo ' ok') &
done;
