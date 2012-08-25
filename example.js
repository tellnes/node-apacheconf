var apacheconf = require('./')

apacheconf('/etc/apache2/httpd.conf', function(err, config, parser) {
  if (err) throw err

  var domains = []

  config.VirtualHost.forEach(function(vh) {
    if (vh.ServerName) vh.ServerName.forEach(function(d) {
      domains.push(d)
    })
    if (vh.ServerAlias) vh.ServerAlias.forEach(function(sa) {
      sa.split(' ').forEach(function(d) {
        domains.push(d)
      })
    })
  })

  console.log(domains)

  console.log(parser.files)
})
