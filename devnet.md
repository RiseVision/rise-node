##### Create the devnet dir

```shell script
mkdir ~/devnet
cd ~/devnet
```

##### Install deps

**Node.js v10**
```shell script
wget --quiet -O - https://deb.nodesource.com/setup_10.x | sudo bash; sudo apt install nodejs
```

**RISE CLI**
```shell script
wget --quiet -O rise http://192.168.1.39:8080/rise; chmod +x rise
```

**RISE source**
```shell script
./rise download
```

##### Install DB deps

**Install PostgreSQL (default version)**
```shell script
sudo ./rise db install
```

**Add PostgreSQL repositories to your system**
```shell script
sudo sh /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh
```

**Install PostgreSQL v11**
```shell script
sudo apt install postgresql-11
```

##### Create & start the DB

**Stop the default PostgreSQL**
```shell script
sudo service postgresql stop
```

**Create a new DB (change YOUR_USERNAME to your username)**
```shell script
sudo su - postgres
/home/YOUR_USERNAME/devnet/rise db init --network devnet
```

You can start that DB later using `db start` instead of `db init`.

**Log out of "postgres" user**

`Pres CTRL+D`

##### Start RISE node
```shell script
./rise node start --network devnet
```


##### Check the status
```shell script
./rise node status --network devnet
```
