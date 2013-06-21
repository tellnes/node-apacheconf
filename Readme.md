# Apacheconf parser for Node.js

[![Dependency Status](https://gemnasium.com/tellnes/node-apacheconf.png)](https://gemnasium.com/tellnes/node-apacheconf)

Apacheconf is an apache config file parser for Node.js.


## Example

```js

    var apacheconf = require('apacheconf')

    apacheconf('/etc/apache2/httpd.conf', function(err, config, parser) {
      if (err) throw err

      console.log(config)
    })
```


## Install

    npm install apacheconf


## Licence

MIT
