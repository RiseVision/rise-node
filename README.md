## Rise-node version 0.1.0

## Installation

Automatic install script for Debian based systems Ubuntu, Mint, Debian.

<b>Install Rise (Testnet)</b>
-- BE SURE NOT TO RUN AS ROOT OR WITH SUDO --

First, go home
```
cd $HOME
```

Then git clone
```
git clone -b testnet https://github.com/RiseVision/rise-node.git
```

Go to the Rise directory
```
cd rise-node
```

Install Rise
```
./rise_manager.bash install
```

Then start the node with this line:
```
./rise_manager.bash start
```

Catch up with current mainnet (download snapshot: y)
```
./rise_manager.bash rebuild
```

Get node status
```
./rise_manager.bash status
```

Insert your passphrase so you can forge:
```
nano config.json
```

And change this section to include your passphrase:
```
"forging": {
        "force": false,
        "secret": ["word1 word2 word3 ..."],
        "access": {
            "whiteList": [
                "127.0.0.1"
            ]
        }
    },
```

And finally restart your node to apply the changes:
```
./rise_manager.bash reload
```

<b>Install Rise (Mainnet)</b>
The same as above, only the git clone section is different:
```
git clone https://github.com/RiseVision/rise-node.git
```

## Authors
- Jan <lepetitjan@icloud.com>
- Mariusz Serek <mariusz@serek.net>
- Goldeneye (Shift Team)
- Ralfs (Shift Team)
- Joey <shiftcurrency@gmail.com>
- Boris Povod <boris@crypti.me>
- Pavel Nekrasov <landgraf.paul@gmail.com>
- Sebastian Stupurac <stupurac.sebastian@gmail.com>
- Oliver Beddows <oliver@lightcurve.io>
- Isabella Dell <isabella@lightcurve.io>

## License

Copyright © 2017 Rise<br>
Copyright © 2016-2017 Shift<br>  
Copyright © 2016-2017 Lisk Foundation

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the [GNU General Public License](https://github.com/RiseVision/rise-node/src/master/LICENSE) along with this program.  If not, see <http://www.gnu.org/licenses/>.

***

This program also incorporates work previously released with lisk `0.7.0` (and earlier) versions under the [MIT License](https://opensource.org/licenses/MIT). To comply with the requirements of that license, the following permission notice, applicable to those parts of the code only, is included below:

Copyright © 2017 Rise<br>
Copyright © 2016-2017 Shift<br>
Copyright © 2016-2017 Lisk Foundation<br>  
Copyright © 2015 Crypti

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
