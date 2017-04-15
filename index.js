var mastodon = require('mastodon');
var pg = require('pg');

var query = `SELECT id 
FROM public_toots
WHERE favourites_count > (
  SELECT avg(favourites_count) 
  FROM public_toots
  WHERE 
    favourites_count > 1
    AND created_at > NOW() - INTERVAL '30 days'
)
AND created_at > NOW() - INTERVAL '5 days';`

var config = {
  user: process.env.DB_USER || 'ambassador',
  database: process.env.DB_NAME || 'mastodon_production',
  password: process.env.DB_PASSWORD || '',
  host: process.env.DB_HOST || '/var/run/postgresql',
  port: 5432, //env var: PGPORT
  max: 2, // max number of clients in the pool
  idleTimeoutMillis: 30000 // how long a client is allowed to remain idle before being closed
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

var boosted = (function() {
  const bucketSpan = 3600; // 1 hour buckets => up to 121 buckets over 5 days
  const buckets = new Map();

  function prune() {
    // Bucket id for 5 days ago
    const threshold = (Date.now() - 5 * 24 * 3600 * 1000) / bucketSpan;

    for (var bucket of buckets.keys()) {
      if (bucket < threshold) buckets.delete(bucket);
    }
  }

  function bucket(row) {
    return row.created_at.getTime() / bucketSpan;
  }

  function already(row) {
    const b = bucket(row);
    return buckets.has(b) && buckets.get(b).has(row_id);
  }

  function set(row) {
    const b = bucket(row);
    if (!buckets.has(b)) buckets.set(b, new Set());
    buckets.get(b).add(row_id);
  }

  return { already, prune, set };
})();

function boost(rows) {
  rows.filter(function(x) { return !boosted.already(x); })
  .forEach(function(row) {
    M.post('/statuses/' + row.id + '/reblog', function(err, result) {
      if (err) {
        if (err.message === 'Validation failed: Reblog of status already exists') {
          boosted.set(row);
          return console.log('Warning: tried to boost #' + row.id + ' but it had already been boosted by this account. Adding to cache.');
        }

        return console.log(err.message);
      }
      boosted.set(row);
      console.log('boosted status #' + row.id);
    });
  })
}

cycle();
// Prune the set of boosted toots every hour
setInterval(boosted.prune, 1000 * 3600);
setInterval(cycle, 1000 * 60 * 15);
