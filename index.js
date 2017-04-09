var mastodon = require('mastodon');
var pg = require('pg');

var query = `SELECT id 
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

// instantiate a new client
var client = new pg.Client(config);

function cycle() {
  // connect to our database
  client.connect(function (err) {
    if (err) throw err;

    // execute a query on our database
    client.query(query, [], function (err, result) {
      if(err) {
        return console.error('error running query', err);
      }

      boost(result.rows);

      // disconnect the client
      client.end(function (err) {
        if (err) throw err;
      });
    });
  });
}

var M = new mastodon({
  access_token: process.env.AMBASSADOR_TOKEN,
  api_url: `${process.env.INSTANCE_HOST}/api/v1/`
});


var boosted = {};
function boost(rows) {
  rows.map(function(row) {
    return row.id;
  })
  .filter(function(id) {
    return !boosted[id];
  })
  .forEach(function(id) {
    M.post(`statuses/${id}/reblog`, function(err, result) {
      console.log(`boosted status #${id}`);
      console.dir(err);
      console.dir(result);
    });
  })
}

cycle();
setInterval(cycle, 1000 * 60 * 15);