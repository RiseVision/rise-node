#!/bin/bash
for i in $(ls packages/*/package.json); do
    PACKAGE=$(cat $i| jq -r ".name" | cut -d '/' -f2 | tr '-' '_');
    for row in $(cat $i | jq -r "(.dependencies | keys | map(select(. | contains(\"@risevision\"))))| .[] | @base64"); do
        _jq() {
         echo ${row} | base64 --decode | cut -d '/' -f2 | tr '-' '_'
        }
        echo "$PACKAGE ->  $(_jq )"
    done
done
