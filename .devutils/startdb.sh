docker run --rm --name pg -e POSTGRES_PASSWORD=password -e POSTGRES_USER=rise -e POSTGRES_DB=rise_testnet_db -p 5432:5432 postgres:9.6-alpine

