#!/bin/bash
 # default = 4 peers
NUMPEERS=${1:-5}
 for (( i=1; i <= NUMPEERS; i++ )) do
    echo -n "PEER $((10000 + $i)):"
    curl --silent http://127.0.0.1:$(( 10000 + $i ))/api/transactions/unconfirmed | jq '.count,(.transactions | map(.id) | join(","))'
done
