var elasticsearch=require('elasticsearch');

var client = new elasticsearch.Client( {  
  hosts: [
    'http://elastic:changeme@localhost:9200/'
    // 'https://[username]:[password]@[server]:[port]/'
  ]
});

module.exports = client;  