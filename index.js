var mastodon = require('mastodon');
var pg = require('pg');

var query = `SELECT id 
FROM statuses 
WHERE favourites_count > (
  SELECT avg(favourites_count) 
  FROM statuses 
  WHERE 
    favourites_count > 1
    AND created_at > NOW() - INTERVAL '30 days'
    AND visibility = 0
)
AND created_at > NOW() - INTERVAL '5 days'
AND visibility = 0;`

var config = {
  user: process.env.DB_USER || 'mastodon',
  database: process.env.DB_NAME || 'mastodon_production',
  password: process.env.DB_PASSWORD || '',
  host: process.env.DB_HOST || '/var/run/postgresql',
  port: 5432, //env var: PGPORT
  max: 2, // max number of clients in the pool
  idleTimeoutMillis: 30000, // how long a client is allowed to remain idle before being closed
};


var client = new pg.Client(config);

function cycle() {
  client.connect(function (err) {
    if (err) throw err;

    client.query(query, [], function (err, result) {
      if(err) {
        return console.error('error running query', err);
      }

      client.end(function (err) {
        if (err) throw err;
      });

      boost(result.rows);
    });
  });
}

var M = new mastodon({
  access_token: process.env.AMBASSADOR_TOKEN,
  api_url: process.env.INSTANCE_HOST + '/api/v1'
});

var boosted = {};

function clearCache() {
  boosted = {};
}

function boost(rows) {
  rows.map(function(row) {
    return row.id;
  })
  .filter(function(id) {
    return !boosted[id];
  })
  .forEach(function(id) {
    M.post('/statuses/' + id + '/reblog', function(err, result) {
      if (err) {
        if (err.message === 'Validation failed: Reblog of status already exists') {
          boosted[id] = true;
          return console.log('Warning: tried to boost #' + id + ' but it had already been boosted by this account. Adding to cache.');
        }

        return console.log(err.message);
      }
      boosted[id] = true;
      console.log('boosted status #' + id);
    });
  })
}

cycle();
// clear that 'cache' daily, 2 seconds before the hour (since cycle runs on the hour)
setInterval(clearCache, (1000 * 60 * 60 * 24) - 2000); 
setInterval(cycle, 1000 * 60 * 15);