var mastodon = require('mastodon');
var pg = require('pg');

var query = `SELECT id, created_at 
FROM public_toots
WHERE favourites_count > (
  SELECT avg(favourites_count) 
  FROM public_toots
  WHERE 
    favourites_count > 1
    AND created_at > NOW() - INTERVAL '30 days'
)
AND created_at > NOW() - INTERVAL '5 days';`

var DB_USER = process.env.DB_USER || 'ambassador';
var DB_NAME = process.env.DB_NAME || 'mastodon_production';
var DB_PASSWORD = process.env.DB_PASSWORD || '';
var DB_HOST = process.env.DB_HOST || '/var/run/postgresql';
var AMBASSADOR_TOKEN = process.env.AMBASSADOR_TOKEN;
var INSTANCE_HOST = process.env.INSTANCE_HOST;

var config = {
  user: process.env.DB_USER || 'ambassador',
  database: process.env.DB_NAME || 'mastodon_production',
  password: process.env.DB_PASSWORD || '',
  host: process.env.DB_HOST || '/var/run/postgresql',
  port: 5432, //env var: PGPORT
  max: 2, // max number of clients in the pool
  idleTimeoutMillis: 30000 // how long a client is allowed to remain idle before being closed
};


console.dir('STARTING AMBASSADOR');
console.log('\tDB_USER:', DB_USER);
console.log('\tDB_NAME:', DB_NAME);
console.log('\tDB_PASSWORD:', DB_PASSWORD.split('').map(function() { return "*" }).join(''));
console.log('\tDB_HOST:', DB_HOST);
console.log('\tAMBASSADOR_TOKEN:', AMBASSADOR_TOKEN);
console.log('\tINSTANCE_HOST:', INSTANCE_HOST);

var client = new pg.Client(config);

function cycle() {
  client.connect(function (err) {
    if (err) {
      console.error('error connecting to client');
      return console.dir(err);
    }

    client.query(query, [], function (err, result) {
      if(err) {
        console.error('error running query');
        return console.dir(err);
      }

      client.end(function (err) {
        if (err) {
          console.error('error disconnecting from client');
          console.dir(err);
        }
      });

      boost(result.rows);
    });
  });
}

var M = new mastodon({
  access_token: AMBASSADOR_TOKEN,
  api_url: INSTANCE_HOST + '/api/v1'
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
    return buckets.has(b) && buckets.get(b).has(row.id);
  }

  function set(row) {
    const b = bucket(row);
    if (!buckets.has(b)) buckets.set(b, new Set());
    buckets.get(b).add(row.id);
  }

  return { already: already, prune: prune, set: set };
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

        return console.log(err);
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
