var mastodon = require('mastodon');
var pg = require('pg');

var query = `SELECT id, favourites_count 
FROM statuses 
WHERE favourites_count > (
  SELECT avg(favourites_count) 
  FROM statuses 
  WHERE favourites_count > 1
  AND created_at > NOW() - INTERVAL '30 days'
)
AND created_at > NOW() - INTERVAL '30 days';`

var config = {
  user: process.env.DB_USER || 'mastodon',
  database: process.env.DB_NAME || 'mastodon_production',
  password: process.env.DB_PASSWORD || '',
  host: process.env.DB_HOST || '/var/run/postgresql',
  port: 5432, //env var: PGPORT
  max: 2, // max number of clients in the pool
  idleTimeoutMillis: 30000, // how long a client is allowed to remain idle before being closed
};

var pg = require('pg');

// instantiate a new client
// the client will read connection information from
// the same environment variables used by postgres cli tools
var client = new pg.Client();

function cycle() {
  // connect to our database
  client.connect(function (err) {
    if (err) throw err;

    // execute a query on our database
    client.query(query, [], function (err, result) {
      if(err) {
        return console.error('error running query', err);
      }

      res.rows.forEach(function(row) {
        console.dir(row);
      });

      // disconnect the client
      client.end(function (err) {
        if (err) throw err;
      });
    });
  });
}

cycle();